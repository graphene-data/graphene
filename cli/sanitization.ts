import safeParse from 'postcss-safe-parser'

export const GLOBAL_HTML_ATTRS = ['class', 'id', 'role', 'aria-*', 'data-*']

const BLOCKED_CSS_EXECUTION = /\bexpression\s*\(|javascript:/i
const BLOCKED_CSS_PROP = /^(?:behavior|-moz-binding)$/i
const DIRECTIVE_ATTR = /\s(?:on|bind|use|transition|in|out|animate|class|style):[A-Za-z_-]/
const SPREAD_ATTR = /\s\{\s*\.\.\./
const EXPRESSION_ATTR = /\s[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*\{/

export function validateStaticMarkup(content: string) {
  content = replaceTagBlocks(content, 'style', () => '')
  content = replaceTagBlocks(content, 'ECharts', block => block.openTag + block.closeTag)
  if (hasTemplateBlockOutsideTags(content)) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
  if (DIRECTIVE_ATTR.test(content)) throw new Error('Framework directives are not supported in Graphene markdown.')
  if (SPREAD_ATTR.test(content)) throw new Error('Attribute spreads are not supported in Graphene markdown.')
  if (EXPRESSION_ATTR.test(content)) throw new Error('Dynamic attribute expressions are not supported in Graphene markdown.')
}

export function validatePreprocessedMarkup(content: string) {
  if (hasTemplateBlockOutsideTags(replaceTagBlocks(content, 'script', () => ''))) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
}

export function sanitizeComponentTag(tagName: string, attribs: Record<string, string>) {
  let safeAttrs: Record<string, string> = {}
  for (let [name, value] of Object.entries(attribs)) {
    if (!isSafeComponentAttr(name)) continue
    safeAttrs[name] = shouldPreserveComponentExpression(tagName, name, value) ? value : escapeSvelteAttrValue(value)
  }
  return {tagName, attribs: safeAttrs}
}

export function extractPageStyles(content: string) {
  let styles: string[] = []
  let html = replaceTagBlocks(content, 'style', block => {
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

export function escapeSvelteTextExpressions(content: string) {
  let out: string[] = []
  let quote = ''
  let inTag = false

  for (let i = 0; i < content.length; i++) {
    let scriptBlock = !inTag ? readTagBlockAt(content, i, 'script') : null
    if (scriptBlock) {
      out.push(scriptBlock.raw)
      i = scriptBlock.end - 1
      continue
    }

    let ch = content[i]
    if (inTag) {
      out.push(ch)
      if (quote && ch == quote) quote = ''
      else if (!quote && (ch == '"' || ch == "'")) quote = ch
      else if (!quote && ch == '>') inTag = false
      continue
    }

    if (ch == '{' && /[@#:/]/.test(content[i + 1] || '')) {
      let end = content.indexOf('}', i + 2)
      if (end != -1) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
    }

    if (ch == '<' && /^[A-Za-z!/]/.test(content[i + 1] || '')) {
      inTag = true
      out.push(ch)
      continue
    }

    out.push(ch == '{' ? '&#123;' : ch)
  }

  return out.join('')
}

function hasTemplateBlockOutsideTags(content: string) {
  let quote = ''
  let inTag = false

  for (let i = 0; i < content.length; i++) {
    let ch = content[i]
    if (inTag) {
      if (quote && ch == quote) quote = ''
      else if (!quote && (ch == '"' || ch == "'")) quote = ch
      else if (!quote && ch == '>') inTag = false
      continue
    }

    if (ch == '<' && /^[A-Za-z!/]/.test(content[i + 1] || '')) {
      inTag = true
      continue
    }
    if (ch == '{' && /[@#:/]/.test(content[i + 1] || '')) return true
  }

  return false
}

function isSafeComponentAttr(name: string) {
  if (name == 'style') return false
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) return false
  if (/^on[A-Z_a-z-]/.test(name)) return false
  return !name.includes(':')
}

function shouldPreserveComponentExpression(tagName: string, name: string, value: string) {
  if (tagName != 'GrapheneQuery') return false
  if (name != 'name' && name != 'code') return false
  if (!value.startsWith('{`') || !value.endsWith('`}')) return false
  return !hasUnescapedInterpolation(value)
}

function hasUnescapedInterpolation(value: string) {
  for (let idx = value.indexOf('${'); idx != -1; idx = value.indexOf('${', idx + 2)) {
    if (value[idx - 1] != '\\') return true
  }
  return false
}

function escapeSvelteAttrValue(value: string) {
  return value.replace(/\{/g, '&#123;')
}

type TagBlock = {openTag: string; body: string; closeTag: string; raw: string; end: number}

function replaceTagBlocks(content: string, tagName: string, replacer: (block: TagBlock) => string) {
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

function readTagBlockAt(content: string, start: number, tagName: string): TagBlock | null {
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
