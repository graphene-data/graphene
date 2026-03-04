import type {SyntaxNode} from '@lezer/common'
import {getFile} from './util.ts'

// Extract metadata from comments that appear directly above a syntax node.
// Rules:
// - Only line comments starting with `--` are considered.
// - Adjacency required: we scan upward; a blank or non-comment line stops the scan.
// - Description lines use plain `-- text` and are concatenated (space-separated).
// - Key-value metadata lines use `--# key=value` and populate metadata[key] = value.
// - If the node is not the first token on its line, ignore leading comments (prevents one comment from applying to multiple fields on the same line).
export function extractLeadingMetadata(node: SyntaxNode): Record<string, string> {
  // 1) Locate the raw file text and find the end of the line immediately above the node
  let src = getFile(node).contents
  if (!src) return {}
  let pos = node.from
  let currentLineStart = src.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  let endOfPrevLine = currentLineStart - 1

  // If there is any non-whitespace before the node on the same line, it is not the first token → don't attach leading comments
  let beforeOnLine = src.slice(currentLineStart, pos)
  let isFirstTokenOnLine = !(/[^\s]/.test(beforeOnLine))

  // 2) Walk upward line-by-line collecting contiguous leading comment lines
  let commentLines: string[] = []
  if (isFirstTokenOnLine && endOfPrevLine >= 0) {
    let cursor = endOfPrevLine
    while (cursor >= 0) {
      let startOfLine = src.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
      let line = src.slice(startOfLine, cursor).trimEnd()
      let trimmed = line.trim()
      if (trimmed.length === 0) break // blank line breaks adjacency
      if (!trimmed.startsWith('--')) break // non-comment line breaks adjacency
      commentLines.push(trimmed)
      cursor = startOfLine - 1
    }
  }

  // We collected bottom-to-top; restore original top-to-bottom order
  commentLines.reverse()

  // 3) Split into description and key=value metadata (from leading comments)
  let metadata: Record<string, string> = {}
  let descriptionLines: string[] = []
  for (let raw of commentLines) {
    let withoutPrefix = raw.slice(2).trimStart() // remove `--`
    if (withoutPrefix.startsWith('#')) {
      // Parse `--# key=value`
      let kv = withoutPrefix.slice(1).trim()
      let eqIdx = kv.indexOf('=')
      if (eqIdx > 0) {
        let key = kv.slice(0, eqIdx).trim()
        let value = kv.slice(eqIdx + 1).trim()
        if (key) metadata[key] = value
      }
      continue
    }
    // Accumulate description lines
    if (withoutPrefix) descriptionLines.push(withoutPrefix)
  }

  // 4) Also consider a trailing same-line comment after this node
  // Rules:
  // - Must be on the same line as the node ends
  // - Only whitespace and optional commas are allowed between node end and the comment start
  // - Trailing comment text can include inline #key=value pairs which populate metadata
  let endPos = node.to
  let endOfLine = src.indexOf('\n', endPos)
  if (endOfLine === -1) endOfLine = src.length
  let after = src.slice(endPos, endOfLine)
  if (after.length) {
    let commentIdx = after.indexOf('--')
    if (commentIdx >= 0) {
      let between = after.slice(0, commentIdx)
      if (/^[\s,]*$/.test(between)) {
        // Valid trailing comment for this node
        let trailingText = after.slice(commentIdx + 2).trimStart()

        // Extract inline #key=value pairs and remove them from description
        let inlineKv = /#([A-Za-z0-9_-]+)=([^\s#]+)/g
        let cleaned = trailingText.replace(inlineKv, (_m, k, v) => {
          if (k) metadata[k] = String(v)
          return ''
        }).trim()
        if (cleaned) descriptionLines.push(cleaned)
      }
    }
  }

  // 5) Join description lines into a single description field
  if (descriptionLines.length) metadata.description = descriptionLines.join(' ')
  return metadata
}
