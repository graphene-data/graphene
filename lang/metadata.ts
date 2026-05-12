import type {SyntaxNode} from '@lezer/common'

import {getFile} from './util.ts'

let embeddedMetadataPair = /(^|\s)(#)([A-Za-z0-9_-]+)(?:\s*=\s*("(?:[^"\\]|\\.)*"|[^\s#]+)|(?=(?:\s*(?:#|--|$))))/g

type CommentKind = 'dash' | 'hash'
export type MetadataEntry = {
  key: string
  value: string
  rawValue?: string
  from: number
  to: number
  valueFrom?: number
  valueTo?: number
  hasValue: boolean
}

export type MetadataDiagnostic = {
  message: string
  from: number
  to: number
}

let isoCurrencyCodes = new Set(Intl.supportedValuesOf('currency').map(code => code.toLowerCase()))

let metadataKeyRules = {
  ratio: {kind: 'flag'},
  pct: {kind: 'flag'},
  pii: {kind: 'flag'},
  currency: {kind: 'currency'},
  unit: {kind: 'string'},
  timeGrain: {kind: 'enum', values: ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second']},
  timeOrdinal: {kind: 'enum', values: ['hour_of_day', 'day_of_month', 'day_of_year', 'week_of_year', 'month_of_year', 'quarter_of_year', 'dow_0s', 'dow_1s', 'dow_1m']},
  description: {kind: 'string'},
} as const

let validMetadataKeys = Object.keys(metadataKeyRules)

// Extract metadata from comments that appear directly above a syntax node.
// Rules:
// - `#` lines are metadata-only comments and may contain multiple `#key` / `#key=value` entries.
// - `--` lines are description comments, but may embed trailing `#key` / `#key=value` metadata.
// - Legacy `--# key=value` lines are ignored.
// - Adjacency required: we scan upward; a blank or non-comment line stops the scan.
// - If the node is not the first token on its line, ignore leading comments.
export function extractLeadingMetadata(node: SyntaxNode): Record<string, string> {
  return extractLeadingMetadataDetails(node).metadata
}

export function extractLeadingMetadataDetails(node: SyntaxNode): {metadata: Record<string, string>; entries: MetadataEntry[]} {
  let src = getFile(node).contents
  if (!src) return {metadata: {}, entries: []}

  let pos = node.from
  let currentLineStart = src.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  let endOfPrevLine = currentLineStart - 1
  let beforeOnLine = src.slice(currentLineStart, pos)
  let isFirstTokenOnLine = !/[^\s]/.test(beforeOnLine)

  let comments: {kind: CommentKind; text: string; from: number; markerFrom: number}[] = []
  if (isFirstTokenOnLine && endOfPrevLine >= 0) {
    let cursor = endOfPrevLine
    while (cursor >= 0) {
      let startOfLine = src.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
      let line = src.slice(startOfLine, cursor)
      let trimmed = line.trim()
      if (!trimmed) break
      let comment = parseCommentLine(line, startOfLine)
      if (!comment) break
      comments.push(comment)
      cursor = startOfLine - 1
    }
  }
  comments.reverse()

  let metadata: Record<string, string> = {}
  let descriptionLines: string[] = []
  let entries: MetadataEntry[] = []
  for (let comment of comments) consumeComment(comment, metadata, descriptionLines, entries)

  let endPos = node.to
  let endOfLine = src.indexOf('\n', endPos)
  if (endOfLine === -1) endOfLine = src.length
  let after = src.slice(endPos, endOfLine)
  let trailing = parseTrailingComment(after, endPos)
  if (trailing) consumeComment(trailing, metadata, descriptionLines, entries)

  if (descriptionLines.length) metadata.description = descriptionLines.join(' ')
  return {metadata, entries}
}

export function validateMetadataEntries(entries: MetadataEntry[]): MetadataDiagnostic[] {
  let diagnostics: MetadataDiagnostic[] = []
  for (let entry of entries) {
    let rule = metadataKeyRules[entry.key as keyof typeof metadataKeyRules]
    if (!rule) {
      diagnostics.push({
        message: `Unknown metadata key "#${entry.key}". Expected one of: ${validMetadataKeys.join(', ')}`,
        from: entry.from,
        to: entry.to,
      })
      continue
    }

    if (rule.kind == 'flag') {
      if (!entry.hasValue || entry.rawValue == 'true') continue
      diagnostics.push({
        message: `Metadata "#${entry.key}" is a flag; use "#${entry.key}" or "#${entry.key}=true".`,
        from: entry.valueFrom ?? entry.from,
        to: entry.valueTo ?? entry.to,
      })
      continue
    }

    if (rule.kind == 'string') {
      if (entry.hasValue && entry.value.trim()) continue
      diagnostics.push({
        message: `Metadata "#${entry.key}" requires a value.`,
        from: entry.from,
        to: entry.to,
      })
      continue
    }

    if (rule.kind == 'currency') {
      if (!entry.hasValue || !entry.value.trim()) {
        diagnostics.push({
          message: 'Metadata "#currency" requires a value.',
          from: entry.from,
          to: entry.to,
        })
        continue
      }
      if (isoCurrencyCodes.has(entry.value.toLowerCase())) continue
      diagnostics.push({
        message: `Invalid value "${entry.value}" for "#currency". Expected an ISO 4217 currency code.`,
        from: entry.valueFrom ?? entry.from,
        to: entry.valueTo ?? entry.to,
      })
      continue
    }

    if (rule.values.includes(entry.value as never)) continue
    diagnostics.push({
      message: `Invalid value "${entry.value}" for "#${entry.key}". Expected one of: ${rule.values.join(', ')}`,
      from: entry.valueFrom ?? entry.from,
      to: entry.valueTo ?? entry.to,
    })
  }
  return diagnostics
}

function parseCommentLine(line: string, lineStart: number): {kind: CommentKind; text: string; from: number; markerFrom: number} | undefined {
  let leading = line.match(/^\s*/)?.[0].length || 0
  let markerFrom = lineStart + leading
  let trimmed = line.slice(leading)
  if (trimmed.startsWith('--')) return withTrimmedText('dash', line, lineStart, markerFrom, leading + 2)
  if (trimmed.startsWith('#')) return withTrimmedText('hash', line, lineStart, markerFrom, leading + 1)
}

function parseTrailingComment(after: string, afterStart: number): {kind: CommentKind; text: string; from: number; markerFrom: number} | undefined {
  let dashIdx = after.indexOf('--')
  let hashIdx = after.indexOf('#')
  let commentIdx = minNonNegative(dashIdx, hashIdx)
  if (commentIdx === -1) return undefined

  let between = after.slice(0, commentIdx)
  if (!/^[\s,]*$/.test(between)) return undefined

  let markerFrom = afterStart + commentIdx
  if (hashIdx !== -1 && hashIdx === commentIdx) return withTrimmedText('hash', after, afterStart, markerFrom, hashIdx + 1)
  return withTrimmedText('dash', after, afterStart, markerFrom, dashIdx + 2)
}

function withTrimmedText(kind: CommentKind, raw: string, rawFrom: number, markerFrom: number, textStart: number) {
  let whitespace = raw.slice(textStart).match(/^\s*/)?.[0].length || 0
  return {kind, text: raw.slice(textStart + whitespace), from: rawFrom + textStart + whitespace, markerFrom}
}

function consumeComment(comment: {kind: CommentKind; text: string; from: number; markerFrom: number}, metadata: Record<string, string>, descriptionLines: string[], entries: MetadataEntry[]) {
  if (comment.kind === 'hash') {
    let cleaned = extractHashMetadata(comment, metadata, entries)
    let trailingDescription = parseHashCommentDescription(cleaned)
    if (trailingDescription) descriptionLines.push(trailingDescription)
    return
  }

  // `--# ...` was the old metadata syntax. Do not keep it working.
  if (comment.text.startsWith('#')) return

  let description = extractMetadataPairs(comment.text, comment.from, metadata, entries)
  if (description) descriptionLines.push(description)
}

function extractHashMetadata(comment: {text: string; from: number; markerFrom: number}, metadata: Record<string, string>, entries: MetadataEntry[]) {
  let text = comment.text
  let cursor = skipWhitespace(text, 0)
  let pair = matchMetadataToken(text, cursor, false, comment.from, comment.markerFrom)
  if (!pair) return text.trim()

  consumePair(pair, metadata, entries)
  cursor = pair.end

  while (true) {
    let nextStart = skipWhitespace(text, cursor)
    if (text[nextStart] !== '#') return text.slice(nextStart).trim()
    let nextPair = matchMetadataToken(text, nextStart, true, comment.from)
    if (!nextPair) return text.slice(nextStart).trim()
    consumePair(nextPair, metadata, entries)
    cursor = nextPair.end
  }
}

function extractMetadataPairs(text: string, textFrom: number, metadata: Record<string, string>, entries: MetadataEntry[]) {
  let cleaned = text.replace(embeddedMetadataPair, (match, leadingSpace, _hash, key, rawValue, offset) => {
    if (key) {
      let hashStart = textFrom + offset + leadingSpace.length
      let valueOffset = rawValue ? match.indexOf(rawValue) : -1
      consumePair(
        {
          key,
          rawValue,
          keyFrom: hashStart + 1,
          keyTo: hashStart + 1 + key.length,
          from: hashStart,
          to: hashStart + 1 + key.length,
          valueFrom: valueOffset >= 0 ? textFrom + offset + valueOffset : undefined,
          valueTo: valueOffset >= 0 ? textFrom + offset + valueOffset + rawValue.length : undefined,
          end: offset + match.length,
        },
        metadata,
        entries,
      )
    }
    return leadingSpace ? ' ' : ''
  })
  return cleaned.replace(/\s+/g, ' ').trim()
}

function consumePair(pair: MetadataToken, metadata: Record<string, string>, entries: MetadataEntry[]) {
  let value = parseMetadataValue(pair.rawValue)
  metadata[pair.key] = value
  entries.push({
    key: pair.key,
    value,
    rawValue: pair.rawValue,
    from: pair.from,
    to: pair.to,
    valueFrom: pair.valueFrom,
    valueTo: pair.valueTo,
    hasValue: pair.rawValue != null,
  })
}

function parseMetadataValue(rawValue?: string) {
  if (!rawValue) return 'true'
  if (!rawValue.startsWith('"')) return rawValue
  return rawValue.slice(1, -1).replace(/\\(["\\])/g, '$1')
}

function parseHashCommentDescription(cleaned: string) {
  if (!cleaned.startsWith('--')) return undefined
  let description = cleaned.slice(2).trim()
  return description || undefined
}

type MetadataToken = {
  key: string
  rawValue?: string
  keyFrom: number
  keyTo: number
  from: number
  to: number
  valueFrom?: number
  valueTo?: number
  end: number
}

function matchMetadataToken(text: string, start: number, hasHashPrefix: boolean, textFrom: number, firstHashFrom?: number): MetadataToken | undefined {
  let cursor = hasHashPrefix ? start + 1 : start
  let keyStart = cursor
  while (/[A-Za-z0-9_-]/.test(text[cursor] || '')) cursor++
  if (cursor === keyStart) return undefined

  let key = text.slice(keyStart, cursor)
  let from = hasHashPrefix ? textFrom + start : (firstHashFrom ?? textFrom + keyStart)
  let keyFrom = textFrom + keyStart
  let keyTo = textFrom + cursor
  let afterKey = skipWhitespace(text, cursor)
  if (text[afterKey] === '=') {
    let valueStart = skipWhitespace(text, afterKey + 1)
    let value = readMetadataValue(text, valueStart)
    if (!value) return undefined
    return {key, rawValue: value.rawValue, keyFrom, keyTo, from, to: keyTo, valueFrom: textFrom + valueStart, valueTo: textFrom + value.end, end: value.end}
  }

  if (afterKey >= text.length || text[afterKey] === '#' || text.startsWith('--', afterKey)) {
    return {key, rawValue: undefined, keyFrom, keyTo, from, to: keyTo, end: afterKey}
  }
}

function readMetadataValue(text: string, start: number) {
  if (!text[start]) return undefined
  if (text[start] === '"') {
    let cursor = start + 1
    while (cursor < text.length) {
      if (text[cursor] === '\\') {
        cursor += 2
        continue
      }
      if (text[cursor] === '"') return {rawValue: text.slice(start, cursor + 1), end: cursor + 1}
      cursor++
    }
    return undefined
  }

  let cursor = start
  while (cursor < text.length && !/[\s#]/.test(text[cursor])) cursor++
  if (cursor === start) return undefined
  return {rawValue: text.slice(start, cursor), end: cursor}
}

function skipWhitespace(text: string, start: number) {
  let cursor = start
  while (/\s/.test(text[cursor] || '')) cursor++
  return cursor
}

function minNonNegative(...values: number[]) {
  let next = values.filter(value => value >= 0)
  return next.length ? Math.min(...next) : -1
}
