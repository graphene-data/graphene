import safeParse from 'postcss-safe-parser'
import {parse as parseSvelte} from 'svelte/compiler'

export const GLOBAL_HTML_ATTRS = ['class', 'id', 'role', 'aria-*', 'data-*']

const BLOCKED_CSS_EXECUTION = /\bexpression\s*\(|javascript:/i
const BLOCKED_CSS_PROP = /^(?:behavior|-moz-binding)$/i

export function validateStaticMarkup(content: string) {
  content = replaceRawTagBlocks(content, 'style', () => '')
  content = replaceRawTagBlocks(content, 'ECharts', block => block.openTag + block.closeTag)
  validateSvelteMarkup(content, {allowSanitizableHtmlAttrs: true})
}

// Validates the final Svelte source after markdown/HTML/CSS preprocessing. The
// HTML sanitizer decides which tags survive; this parser pass rejects Svelte
// syntax that would execute JavaScript if it reached the compiler.
export function validateSvelteMarkup(content: string, opts: SvelteValidationOptions = {}) {
  let ast
  try {
    ast = parseSvelte(content, {modern: true})
  } catch (err) {
    if (isSvelteDynamicMarkupParseError(err)) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.', {cause: err})
    throw err
  }
  validateSvelteFragment(ast.fragment, opts)
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

type SvelteValidationOptions = {allowSanitizableHtmlAttrs?: boolean}

function isSvelteDynamicMarkupParseError(err: unknown) {
  return typeof err == 'object' && err != null && 'code' in err && typeof err.code == 'string' && err.code.startsWith('block_')
}

function validateSvelteFragment(fragment: any, opts: SvelteValidationOptions) {
  for (let node of fragment.nodes || []) validateSvelteNode(node, opts)
}

function validateSvelteNode(node: any, opts: SvelteValidationOptions) {
  if (node.type == 'Text' || node.type == 'Comment') return

  if (node.type == 'RegularElement' || node.type == 'Component') {
    validateSvelteElement(node, opts)
    return
  }

  if (node.type == 'SvelteHead') {
    validateSvelteHead(node, opts)
    return
  }

  if (node.type == 'SpreadAttribute') throw new Error('Attribute spreads are not supported in Graphene markdown.')
  if (node.type == 'ExpressionTag' || node.type == 'HtmlTag') throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
  if (node.type?.endsWith('Block') || node.type?.endsWith('Tag')) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
  if (node.type?.endsWith('Directive')) throw new Error('Framework directives are not supported in Graphene markdown.')
  if (node.type?.startsWith('Svelte') || node.type?.endsWith('Element')) throw new Error('Special Svelte elements are not supported in Graphene markdown.')

  throw new Error(`Unsupported Svelte syntax in Graphene markdown: ${node.type}`)
}

function validateSvelteHead(node: any, opts: SvelteValidationOptions) {
  validateSvelteAttributes(node, opts)

  for (let child of node.fragment.nodes || []) {
    if (child.type != 'RegularElement' || child.name != 'style') throw new Error('Special Svelte elements are not supported in Graphene markdown.')
    validateSvelteAttributes(child, opts)
    validateSvelteFragment(child.fragment, opts)
  }
}

function validateSvelteElement(node: any, opts: SvelteValidationOptions) {
  if (node.name?.toLowerCase() == 'script') throw new Error('Script tags are not supported in Graphene markdown.')
  validateSvelteAttributes(node, opts)
  validateSvelteFragment(node.fragment, opts)
}

function validateSvelteAttributes(node: any, opts: SvelteValidationOptions) {
  for (let attr of node.attributes || []) {
    if (attr.type == 'SpreadAttribute') throw new Error('Attribute spreads are not supported in Graphene markdown.')
    if (attr.type != 'Attribute') throw new Error('Framework directives are not supported in Graphene markdown.')
    if (!opts.allowSanitizableHtmlAttrs && (/^on/i.test(attr.name) || attr.name == 'style')) throw new Error('Unsafe HTML attributes are not supported in Graphene markdown.')
    if (attr.name.includes(':')) throw new Error('Framework directives are not supported in Graphene markdown.')
    validateSvelteAttributeValue(node, attr)
  }
}

function validateSvelteAttributeValue(node: any, attr: any) {
  if (attr.value === true) return

  let values: any[] = []
  if (Array.isArray(attr.value)) values = attr.value
  else if (attr.value) values = [attr.value]

  for (let value of values) {
    if (value.type == 'Text') continue
    if (value.type == 'ExpressionTag' && isAllowedGeneratedExpressionAttr(node, attr, value.expression)) continue
    throw new Error(`Dynamic attribute expressions are not supported in Graphene markdown: <${node.name} ${attr.name}>.`)
  }
}

function isAllowedGeneratedExpressionAttr(node: any, attr: any, expression: any) {
  if (node.type != 'Component') return false
  if (node.name == 'GrapheneQuery' && (attr.name == 'name' || attr.name == 'code')) return isStaticTemplateLiteral(expression)
  if (node.name == 'ECharts' && attr.name == 'config') return isJsonLiteralExpression(expression)
  return false
}

function isStaticTemplateLiteral(expression: any) {
  return expression.type == 'TemplateLiteral' && expression.expressions.length == 0
}

function isJsonLiteralExpression(expression: any): boolean {
  if (expression.type == 'Literal') return true
  if (expression.type == 'UnaryExpression') return expression.operator == '-' && expression.argument.type == 'Literal'
  if (expression.type == 'ArrayExpression') return expression.elements.every((elem: any) => elem && isJsonLiteralExpression(elem))
  if (expression.type != 'ObjectExpression') return false

  return expression.properties.every((prop: any) => {
    if (prop.type != 'Property' || prop.method || prop.computed || prop.kind != 'init') return false
    return isJsonLiteralExpression(prop.value)
  })
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

export type RawTagBlock = {openTag: string; body: string; closeTag: string; raw: string; end: number}

// Graphene has a few raw-body tags whose contents are not Svelte child markup
// yet: inline ECharts configs and dashboard style blocks. This helper only
// isolates those known paired tags; sanitize-html and the Svelte parser still
// own general HTML sanitization and executable syntax validation.
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
