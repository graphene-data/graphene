import type {SyntaxNode} from '@lezer/common'

import {getFile} from './util.ts'

let metadataPair = /(^|\s)(#)\s*([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^\s#]+)/g

type CommentKind = 'dash' | 'hash'

// Extract metadata from comments that appear directly above a syntax node.
// Rules:
// - `#` lines are metadata-only comments and may contain multiple `#key=value` entries.
// - `--` lines are description comments, but may embed trailing `#key=value` metadata.
// - Legacy `--# key=value` lines are ignored.
// - Adjacency required: we scan upward; a blank or non-comment line stops the scan.
// - If the node is not the first token on its line, ignore leading comments.
export function extractLeadingMetadata(node: SyntaxNode): Record<string, string> {
  let src = getFile(node).contents
  if (!src) return {}

  let pos = node.from
  let currentLineStart = src.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  let endOfPrevLine = currentLineStart - 1
  let beforeOnLine = src.slice(currentLineStart, pos)
  let isFirstTokenOnLine = !/[^\s]/.test(beforeOnLine)

  let comments: {kind: CommentKind; text: string}[] = []
  if (isFirstTokenOnLine && endOfPrevLine >= 0) {
    let cursor = endOfPrevLine
    while (cursor >= 0) {
      let startOfLine = src.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
      let trimmed = src.slice(startOfLine, cursor).trim()
      if (!trimmed) break
      let comment = parseCommentLine(trimmed)
      if (!comment) break
      comments.push(comment)
      cursor = startOfLine - 1
    }
  }
  comments.reverse()

  let metadata: Record<string, string> = {}
  let descriptionLines: string[] = []
  for (let comment of comments) consumeComment(comment, metadata, descriptionLines)

  let endPos = node.to
  let endOfLine = src.indexOf('\n', endPos)
  if (endOfLine === -1) endOfLine = src.length
  let after = src.slice(endPos, endOfLine)
  let trailing = parseTrailingComment(after)
  if (trailing) consumeComment(trailing, metadata, descriptionLines)

  if (descriptionLines.length) metadata.description = descriptionLines.join(' ')
  return metadata
}

function parseCommentLine(trimmed: string): {kind: CommentKind; text: string} | undefined {
  if (trimmed.startsWith('--')) return {kind: 'dash', text: trimmed.slice(2).trimStart()}
  if (trimmed.startsWith('#')) return {kind: 'hash', text: trimmed.slice(1).trimStart()}
}

function parseTrailingComment(after: string): {kind: CommentKind; text: string} | undefined {
  let dashIdx = after.indexOf('--')
  let hashIdx = after.indexOf('#')
  let commentIdx = minNonNegative(dashIdx, hashIdx)
  if (commentIdx === -1) return undefined

  let between = after.slice(0, commentIdx)
  if (!/^[\s,]*$/.test(between)) return undefined

  if (hashIdx !== -1 && hashIdx === commentIdx) return {kind: 'hash', text: after.slice(hashIdx + 1).trimStart()}
  return {kind: 'dash', text: after.slice(dashIdx + 2).trimStart()}
}

function consumeComment(comment: {kind: CommentKind; text: string}, metadata: Record<string, string>, descriptionLines: string[]) {
  if (comment.kind === 'hash') {
    let cleaned = extractMetadataPairs(`# ${comment.text}`, metadata)
    let trailingDescription = parseHashCommentDescription(cleaned)
    if (trailingDescription) descriptionLines.push(trailingDescription)
    return
  }

  // `--# ...` was the old metadata syntax. Do not keep it working.
  if (comment.text.startsWith('#')) return

  let description = extractMetadataPairs(comment.text, metadata)
  if (description) descriptionLines.push(description)
}

function extractMetadataPairs(text: string, metadata: Record<string, string>) {
  let cleaned = text.replace(metadataPair, (match, leadingSpace, _hash, key, rawValue) => {
    if (key) metadata[key] = parseMetadataValue(rawValue)
    return leadingSpace ? ' ' : ''
  })
  return cleaned.replace(/\s+/g, ' ').trim()
}

function parseMetadataValue(rawValue: string) {
  if (!rawValue.startsWith('"')) return rawValue
  return rawValue.slice(1, -1).replace(/\\(["\\])/g, '$1')
}

function parseHashCommentDescription(cleaned: string) {
  if (!cleaned.startsWith('--')) return undefined
  let description = cleaned.slice(2).trim()
  return description || undefined
}

function minNonNegative(...values: number[]) {
  let next = values.filter(value => value >= 0)
  return next.length ? Math.min(...next) : -1
}
