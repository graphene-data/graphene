import type {SyntaxNode} from '@lezer/common'

function getSourceForNode (node: SyntaxNode): string {
  let top: SyntaxNode = node
  while (top.parent) top = top.parent
  return top.tree?.rawText || ''
}

// Extract metadata from comments that appear directly above a syntax node.
// Rules:
// - Only line comments starting with `--` are considered.
// - Adjacency required: we scan upward; a blank or non-comment line stops the scan.
// - Description lines use plain `-- text` and are concatenated (space-separated).
// - Key-value metadata lines use `--# key=value` and populate metadata[key] = value.
// - If the node is not the first token on its line, ignore leading comments (prevents one comment from applying to multiple fields on the same line).
export function extractLeadingMetadata (node: SyntaxNode): Record<string, string> {
  // 1) Locate the raw file text and find the end of the line immediately above the node
  let src = getSourceForNode(node)
  if (!src) return {}
  let pos = node.from
  let currentLineStart = src.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  let endOfPrevLine = currentLineStart - 1
  if (endOfPrevLine < 0) return {}

  // If there is any non-whitespace before the node on the same line, it is not the first token → don't attach leading comments
  let beforeOnLine = src.slice(currentLineStart, pos)
  if (/[^\s]/.test(beforeOnLine)) return {}

  // 2) Walk upward line-by-line collecting contiguous leading comment lines
  let commentLines: string[] = []
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
  if (commentLines.length === 0) return {}

  // We collected bottom-to-top; restore original top-to-bottom order
  commentLines.reverse()

  // 3) Split into description and key=value metadata
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

  // 4) Join description lines into a single description field
  if (descriptionLines.length) metadata.description = descriptionLines.join(' ')
  return metadata
}
