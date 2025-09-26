import {parser} from './parser.js'
import type {FileInfo} from './types.ts'

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
// Only components with a `data` attribute get turned into queries, and only attributes in a static list are fields to select [x, y, series] to start, but make it a const we can easily add to.

const GSQL_FENCE = /^([ \t]*)(`{3,})g?sql[^\n]*\n([\s\S]*?)^\1\2[ \t]*$/gim
const COMPONENT_TAG = /<([A-Z][A-Za-z0-9]*)\s+[^>]*\/>/g
const ATTRIBUTE = /(\w+)="([^"]*)"/g

interface FenceMatch {
  start: number
  end: number
  headerLength: number
  contentStart: number
  content: string
  name?: string
}

interface ComponentMatch {
  start: number
  end: number
  data: AttrMatch | null
  x: AttrMatch | null
  y: AttrMatch | null
}

interface AttrMatch {
  value: string
  start: number
}

export function parseMarkdown (fi: FileInfo) {
  let source = fi.contents
  let fences = collectFences(source)
  let components = collectComponents(source, fences)
  let events = [...fences, ...components].sort((a, b) => a.start - b.start)

  let virtual: string[] = []
  let mapping: number[] = []
  let cursor = 0

  let appendWhitespace = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      let ch = source[i]
      virtual.push(ch === '\n' || ch === '\r' ? ch : ' ')
      mapping.push(i)
    }
  }

  let appendMapped = (text: string, mapFn: (i: number) => number) => {
    for (let i = 0; i < text.length; i++) {
      virtual.push(text[i])
      mapping.push(mapFn(i))
    }
  }

  let appendContent = (text: string, contentStart: number) => {
    for (let i = 0; i < text.length; i++) {
      virtual.push(text[i])
      mapping.push(contentStart + i)
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
        appendMapped(`table ${fence.name} as (\n`, () => contentStart)
        appendContent(content, contentStart)
        if (!content.endsWith('\n')) appendMapped('\n', () => contentStart + content.length)
        appendMapped(')\n', () => fence.end - 1)
      } else {
        appendContent(content, contentStart)
      }
      cursor = fence.end
      continue
    }

    let component = event as ComponentMatch
    let {data, x, y} = component
    if (data && x && y) {
      let queryParts = [
        {text: 'from ', map: () => component.start},
        {text: data.value, map: (i: number) => data.start + i},
        {text: ' select ', map: () => component.start},
        {text: x.value, map: (i: number) => x.start + i},
        {text: ', ', map: () => component.start},
        {text: y.value, map: (i: number) => y.start + i},
        {text: ';\n', map: () => component.end},
      ]
      for (let part of queryParts) appendMapped(part.text, part.map)
    }
    cursor = component.end
  }

  appendWhitespace(cursor, source.length)

  let doc = virtual.join('')
  fi.virtualContents = doc
  fi.virtualToMarkdownOffset = [...mapping, source.length]
  return parser.parse(doc)
}

function collectFences (source: string): FenceMatch[] {
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
    let name = extractFenceName(full.slice(0, headerLength))
    matches.push({start, end: start + full.length, headerLength, contentStart, content, name})
  }
  return matches
}

function collectComponents (source: string, fences: FenceMatch[]): ComponentMatch[] {
  let matches: ComponentMatch[] = []
  COMPONENT_TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COMPONENT_TAG.exec(source))) {
    let start = match.index ?? 0
    let end = start + match[0].length
    if (isInsideFence(start, fences)) continue
    let attrs = extractAttributes(match[0], start)
    matches.push({start, end, data: attrs.data || null, x: attrs.x || null, y: attrs.y || null})
  }
  return matches
}

function extractFenceName (header: string): string | undefined {
  let parts = header.trim().split(/\s+/)
  if (parts.length > 1) return parts[1]
  return undefined
}

function extractAttributes (fragment: string, baseStart: number): Record<string, AttrMatch> {
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

function isInsideFence (offset: number, fences: FenceMatch[]) {
  return fences.some(f => offset >= f.start && offset < f.end)
}

function isFence (event: FenceMatch | ComponentMatch): event is FenceMatch {
  return (event as FenceMatch).content !== undefined
}
