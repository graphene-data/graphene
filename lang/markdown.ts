import type {ParsedFileArtifacts, WorkspaceFileInput} from './types.ts'

import {parser} from './parser.js'

// This parser turns Graphene md files into the equivalent gsql, and then parses that gsql.
// Code fences are turned in to table definitions, while Component calls are turned into queries.
// so:
// ```gsql test_table
// from users where age > 20
// ```
// <BarChart data="test_table" x="name" y="avg(age)" />
//
// becomes:
// table test_table as (from users where age > 20)
// from test_table select name, avg(age)
//
// Only components with a `data` attribute get turned into queries, and only attributes in a static list are fields to select.

const COMPONENT_ATTRIBUTE_KEYS = ['x', 'y', 'y2', 'series', 'value', 'category'] as const
type ComponentAttributeKey = (typeof COMPONENT_ATTRIBUTE_KEYS)[number]

const GSQL_FENCE = /^([ \t]*)(`{3,})g?sql[^\n]*\n([\s\S]*?)^\1\2[ \t]*$/gim
const COMPONENT_TAG = /<([A-Z][A-Za-z0-9]*)\s+(?:[^>"']|"[^"]*"|'[^']*')*\/>/g
const ATTRIBUTE = /(\w+)="([^"]*)"/g

interface FenceMatch {
  start: number
  end: number
  headerLength: number
  contentStart: number
  content: string
  name?: string
  nameStart?: number
}

interface ComponentMatch {
  start: number
  end: number
  data: AttrMatch | null
  attributes: Partial<Record<ComponentAttributeKey, AttrMatch>>
}

interface AttrMatch {
  value: string
  start: number
}

export function parseMarkdown(file: WorkspaceFileInput): ParsedFileArtifacts {
  let source = file.contents
  let fences = collectFences(source)
  let components = collectComponents(source, fences)
  let events = [...fences, ...components].sort((a, b) => a.start - b.start)

  let virtual: string[] = []
  let mapping: number[] = []
  let cursor = 0
  let lastMapped = -1
  let maxOffset = source.length

  let push = (ch: string, target: number) => {
    let mapped = target
    if (mapped <= lastMapped) mapped = lastMapped + 1
    if (mapped > maxOffset) mapped = maxOffset
    virtual.push(ch)
    mapping.push(mapped)
    lastMapped = mapped
  }

  let resetLast = (value: number) => {
    lastMapped = value
  }

  let appendWhitespace = (start: number, end: number) => {
    resetLast(start - 1)
    for (let i = start; i < end; i++) {
      let ch = source[i]
      push(ch === '\n' || ch === '\r' ? ch : ' ', i)
    }
  }

  let appendMapped = (text: string, mapFn: (i: number) => number, options?: {reset?: number}) => {
    if (options?.reset !== undefined) resetLast(options.reset)
    for (let i = 0; i < text.length; i++) {
      push(text[i], mapFn(i))
    }
  }

  let appendContent = (text: string, contentStart: number) => {
    resetLast(contentStart - 1)
    for (let i = 0; i < text.length; i++) {
      let target = contentStart + i
      virtual.push(text[i])
      mapping.push(target)
      lastMapped = target
    }
  }

  for (let event of events) {
    if (event.start < cursor) continue
    appendWhitespace(cursor, event.start)
    cursor = event.start

    if (isFence(event)) {
      let fence = event
      let contentStart = fence.contentStart
      let content = fence.content
      if (fence.name) {
        let name = fence.name
        appendMapped('table ', () => fence.start, {reset: fence.start - 1})
        let nameStart = fence.nameStart ?? contentStart
        appendMapped(name, i => nameStart + i, {reset: nameStart - 1})
        appendMapped(' ', () => nameStart + name.length, {reset: nameStart + name.length - 1})
        appendMapped('as (\n', () => contentStart, {reset: contentStart - 1})
        appendContent(content, contentStart)
        if (!content.endsWith('\n')) appendMapped('\n', () => contentStart + content.length, {reset: contentStart + content.length - 1})
        appendMapped(')\n', () => fence.end - 1, {reset: fence.end - 2})
      } else {
        appendContent(content, contentStart)
      }
      cursor = fence.end
      continue
    }

    let component = event as ComponentMatch
    let {data, attributes} = component
    let hasComponentAttribute = COMPONENT_ATTRIBUTE_KEYS.some(key => attributes[key] !== undefined)
    if (data && hasComponentAttribute) {
      appendMapped('from ', () => component.start, {reset: component.start - 1})
      appendMapped(data.value, (i: number) => data.start + i, {reset: data.start - 1})
      appendMapped(' select ', () => component.start)

      let previousAttr: AttrMatch | null = null
      for (let key of COMPONENT_ATTRIBUTE_KEYS) {
        let attribute = attributes[key]
        if (!attribute) continue
        if (previousAttr) {
          let prevEnd = previousAttr.start + previousAttr.value.length
          appendMapped(', ', () => prevEnd)
        }
        appendMapped(attribute.value, (i: number) => attribute.start + i, {reset: attribute.start - 1})
        previousAttr = attribute
      }

      let lastAttr = previousAttr
      let selectEnd = lastAttr ? lastAttr.start + lastAttr.value.length : data.start + data.value.length
      let resetPoint = lastAttr ? lastAttr.start + lastAttr.value.length - 1 : data.start + data.value.length - 1
      appendMapped(
        ';\n',
        (i: number) => {
          if (i === 0) return selectEnd
          return component.end
        },
        {reset: resetPoint},
      )
    }
    cursor = component.end
  }

  appendWhitespace(cursor, source.length)

  let doc = virtual.join('')
  return {
    tree: parser.parse(doc),
    virtualContents: doc,
    virtualToMarkdownOffset: [...mapping, source.length],
  }
}

function collectFences(source: string): FenceMatch[] {
  let matches: FenceMatch[] = []
  GSQL_FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = GSQL_FENCE.exec(source))) {
    let start = match.index ?? 0
    let full = match[0]
    let headerLength = full.indexOf('\n')
    if (headerLength === -1) continue
    headerLength += 1
    let content = match[3] || ''
    let contentStart = start + headerLength
    let {name, index} = extractFenceName(full.slice(0, headerLength))
    matches.push({start, end: start + full.length, headerLength, contentStart, content, name, nameStart: index == null ? undefined : start + index})
  }
  return matches
}

function collectComponents(source: string, fences: FenceMatch[]): ComponentMatch[] {
  let matches: ComponentMatch[] = []
  COMPONENT_TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COMPONENT_TAG.exec(source))) {
    let start = match.index ?? 0
    let end = start + match[0].length
    if (isInsideFence(start, fences)) continue
    let attrs = extractAttributes(match[0], start)
    let attributeMatches: Partial<Record<ComponentAttributeKey, AttrMatch>> = {}
    for (let key of COMPONENT_ATTRIBUTE_KEYS) {
      if (attrs[key]) attributeMatches[key] = attrs[key]
    }
    matches.push({start, end, data: attrs.data || null, attributes: attributeMatches})
  }
  return matches
}

function extractFenceName(header: string): {name?: string; index?: number} {
  let parts = header.trim().split(/\s+/)
  if (parts.length > 1) return {name: parts[1], index: header.indexOf(parts[1])}
  return {}
}

function extractAttributes(fragment: string, baseStart: number): Record<string, AttrMatch> {
  let attrs: Record<string, AttrMatch> = {}
  ATTRIBUTE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE.exec(fragment))) {
    let key = match[1]
    let value = match[2]
    let valueStart = baseStart + match.index + key.length + 2
    attrs[key] = {value, start: valueStart}
  }
  return attrs
}

function isInsideFence(offset: number, fences: FenceMatch[]) {
  return fences.some(f => offset >= f.start && offset < f.end)
}

function isFence(event: FenceMatch | ComponentMatch): event is FenceMatch {
  return (event as FenceMatch).content !== undefined
}
