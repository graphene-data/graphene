import safeParse from 'postcss-safe-parser'
import {parse as parseSvelte} from 'svelte/compiler'

const BLOCKED_CSS_EXECUTION = /\bexpression\s*\(|javascript:/i
const BLOCKED_CSS_PROP = /^(?:behavior|-moz-binding)$/i

// Validates the final Svelte source after markdown/HTML/CSS preprocessing. User
// pages run in a sandboxed frame, so authored Svelte scripts, expressions, and
// event handlers are allowed; malformed Svelte still fails here with compiler
// diagnostics.
export function validateSvelteMarkup(content: string) {
  parseSvelte(content, {modern: true})
}

export function extractPageStyles(content: string) {
  let styles: string[] = []
  let html = replaceRawTagBlocks(content, 'style', block => {
    let sanitized = sanitizeCss(block.body)
    if (sanitized.trim()) styles.push(sanitized)
    return ''
  })
  return {html, css: styles.join('\n')}
}

export function sanitizeCss(css: string) {
  let root = safeParse(css.replace(/[<>]/g, ''))
  root.walkComments(comment => comment.remove())
  root.walkAtRules(rule => {
    if (BLOCKED_CSS_EXECUTION.test(rule.params)) rule.remove()
  })
  root.walkDecls(decl => {
    if (BLOCKED_CSS_PROP.test(decl.prop) || BLOCKED_CSS_EXECUTION.test(decl.value)) decl.remove()
  })
  return root.toString().replace(/;\s*;/g, ';')
}

export type RawTagBlock = {openTag: string; body: string; closeTag: string; raw: string; end: number}

// Graphene has a few raw-body tags whose contents are not Svelte child markup
// yet: inline ECharts configs and dashboard style blocks. This helper only
// isolates those known paired tags so the markdown compiler can transform them
// before the final Svelte parser pass.
export function replaceRawTagBlocks(content: string, tagName: string, replacer: (block: RawTagBlock) => string) {
  let out = ''
  let i = 0

  while (i < content.length) {
    let start = findTagOpen(content, tagName, i)
    if (start == -1) return out + content.slice(i)

    let block = readTagBlockAt(content, start, tagName)
    if (!block) {
      out += content.slice(i, start + 1)
      i = start + 1
      continue
    }

    out += content.slice(i, start) + replacer(block)
    i = block.end
  }

  return out
}

function readTagBlockAt(content: string, start: number, tagName: string): RawTagBlock | null {
  if (findTagOpen(content, tagName, start) != start) return null

  let openEnd = findTagEnd(content, start)
  if (openEnd == -1) return null

  let closeStart = findTagClose(content, tagName, openEnd + 1)
  if (closeStart == -1) return null

  let closeEnd = findTagEnd(content, closeStart)
  if (closeEnd == -1) return null

  let end = closeEnd + 1
  return {
    openTag: content.slice(start, openEnd + 1),
    body: content.slice(openEnd + 1, closeStart),
    closeTag: content.slice(closeStart, end),
    raw: content.slice(start, end),
    end,
  }
}

function findTagOpen(content: string, tagName: string, from: number) {
  return findTag(content, `<${tagName.toLowerCase()}`, from)
}

function findTagClose(content: string, tagName: string, from: number) {
  return findTag(content, `</${tagName.toLowerCase()}`, from)
}

function findTag(content: string, needle: string, from: number) {
  let lower = content.toLowerCase()
  for (let idx = lower.indexOf(needle, from); idx != -1; idx = lower.indexOf(needle, idx + 1)) {
    let next = content[idx + needle.length] || ''
    if (next == '>' || /\s/.test(next)) return idx
  }
  return -1
}

function findTagEnd(content: string, start: number) {
  let quote = ''

  for (let i = start; i < content.length; i++) {
    let ch = content[i]
    if (quote && ch == quote) quote = ''
    else if (!quote && (ch == '"' || ch == "'")) quote = ch
    else if (!quote && ch == '>') return i
  }

  return -1
}
