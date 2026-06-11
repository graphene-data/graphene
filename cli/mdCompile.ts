import type {Plugin} from 'unified'

import {decodeHTML} from 'entities'
import fs from 'fs'
import yaml from 'js-yaml'
import JSON5 from 'json5'
import path from 'path'
import sanitizeHtml from 'sanitize-html'
import {visit} from 'unist-util-visit'

const GLOBAL_HTML_ATTRS = ['class', 'id', 'role', 'aria-*', 'data-*']
const BLOCKED_CSS_VALUE = /\b(?:url|image-set|cross-fade|element|paint|expression)\s*\(|javascript:/i
const BLOCKED_CSS_PROP = /^(?:behavior|-moz-binding)$/i
const STYLE_BLOCK = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi
const DIRECTIVE_ATTR = /\s(?:on|bind|use|transition|in|out|animate|class|style):[A-Za-z_-]/
const SPREAD_ATTR = /\s\{\s*\.\.\./
const EXPRESSION_ATTR = /\s[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*\{/

// Use JS escapes for HTML-sensitive chars so Svelte restores them before query registration.
function svelteStringAttr(str: string) {
  let literal = str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/&/g, '\\u0026')
    .replace(/"/g, '\\u0022')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
  return `{\`${literal}\`}`
}

// Takes the contents of a <ECharts> tag, and json5 parses it
export function liftInlineEChartsConfig(content: string) {
  return content.replace(/<ECharts\b([^>]*)>([\s\S]*?)<\/ECharts>/g, (match: string, attrs = '', body = '') => {
    let inline = body.trim()
    if (!inline) return match
    if (/\sconfig\s*=/.test(attrs)) return match
    let source = inline.startsWith('{') ? inline : `{${inline}}`
    let config = JSON.stringify(JSON5.parse(source), (_key, value) => (typeof value == 'string' ? decodeHTML(value) : value))
    return `<ECharts${attrs} config={${config}}></ECharts>`
  })
}

// Turn code fences into <GrapheneQuery> tags, which register those queries
export function extractQueries() {
  return function transformer(tree: any) {
    visit(tree, 'code', (node, index, parent) => {
      if (index === null) return
      let name = typeof node.meta === 'string' ? node.meta : ''
      let code = typeof node.value === 'string' ? node.value.trim() : ''
      parent.children[index] = {type: 'html', value: `<GrapheneQuery name="${svelteStringAttr(name)}" code="${svelteStringAttr(code)}" />`}
    })
  }
}

// remark will leave less-than and greater-than unescaped, which breaks svelte and prevents the page from loading.
export function escapeAngles() {
  return function transformer(tree: any) {
    visit(tree, 'text', (node: any) => {
      if (!node.value || typeof node.value !== 'string') return
      if (!node.value.includes('<')) return
      node.value = node.value.replace(/</g, '&lt;')
    })
  }
}

// remark can split one html block into adjacent html nodes when self-closing tags are involved.
// Merge those sibling html nodes so downstream rehype/sanitize work on the full block.
export function mergeAdjacentHtml() {
  return function transformer(tree: any) {
    visit(tree, (parent: any) => {
      if (!Array.isArray(parent?.children)) return

      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i]?.type !== 'html') continue

        let j = i
        while (j + 1 < parent.children.length && parent.children[j + 1]?.type === 'html') j++
        if (j == i) continue

        let value = parent.children
          .slice(i, j + 1)
          .map((node: any) => node.value || '')
          .join('\n')
        parent.children.splice(i, j - i + 1, {type: 'html', value})
      }
    })
  }
}

// Restrict allowed components in markdown files to avoid xss issues.
// This uses sanitize-html rather than rehype-sanitize because the latter had lots of issues with preserving tag casing,
// as well as allowing all attributes on our allowlisted components.
export function sanitizeMarkdown() {
  return function transformer(tree: any) {
    visit(tree, 'raw', (node: any) => {
      if (typeof node.value !== 'string') return
      validateStaticMarkup(node.value)

      // sanitize-html doesn't like non-standard self-closing tags, so we need to rewrite them into open+close tags
      let expanded = node.value.replace(/<(\w+)((?:\s[^<>]*?)?)\s*\/>/gi, (_: string, name: string, attrs = '') => {
        let spacing = attrs
        return `<${name}${spacing}></${name}>`
      })

      let sanitized = sanitizeHtml(expanded, {
        ...sanitizeHtml.defaults,
        allowedTags: [...sanitizeHtml.defaults.allowedTags, ...componentNames(), 'style'],
        // Only suppresses sanitize-html's warning for allowing <style>. We extract style
        // blocks later, sanitize their CSS ourselves, and remove the raw tags from page HTML.
        allowVulnerableTags: true,
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': GLOBAL_HTML_ATTRS,
          ...Object.fromEntries(componentNames().map(n => [n, ['*']])),
        },
        transformTags: Object.fromEntries(componentNames().map(n => [n, sanitizeComponentTag])),
        parser: {
          ...((sanitizeHtml.defaults as any).parser || {}),
          lowerCaseAttributeNames: false,
          lowerCaseTags: false,
        },
      })
      node.value = sanitized
    })
  }
}

export function validateStaticMarkup(content: string) {
  content = content.replace(STYLE_BLOCK, '').replace(/(<ECharts\b[^>]*>)[\s\S]*?(<\/ECharts>)/g, '$1$2')
  if (hasTemplateBlockOutsideTags(content)) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
  if (DIRECTIVE_ATTR.test(content)) throw new Error('Framework directives are not supported in Graphene markdown.')
  if (SPREAD_ATTR.test(content)) throw new Error('Attribute spreads are not supported in Graphene markdown.')
  if (EXPRESSION_ATTR.test(content)) throw new Error('Dynamic attribute expressions are not supported in Graphene markdown.')
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

function sanitizeComponentTag(tagName: string, attribs: Record<string, string>) {
  let safeAttrs: Record<string, string> = {}
  for (let [name, value] of Object.entries(attribs)) {
    if (!isSafeComponentAttr(name)) continue
    safeAttrs[name] = shouldPreserveComponentExpression(tagName, name, value) ? value : escapeSvelteAttrValue(value)
  }
  return {tagName, attribs: safeAttrs}
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

export function extractPageStyles(content: string) {
  let styles: string[] = []
  let html = content.replace(STYLE_BLOCK, (_match, css = '') => {
    let sanitized = sanitizeCss(css)
    if (sanitized.trim()) styles.push(sanitized)
    return ''
  })
  return {html, css: styles.join('\n')}
}

export function sanitizeCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@(?:import|namespace)\b[^;]*(?:;|$)/gi, '')
    .replace(/[<>]/g, '')
    .replace(/(^|[;{])\s*([-\w]+)\s*:\s*((?:"[^"]*"|'[^']*'|\([^)]*\)|[^;}])*)(?=[;}])/g, (match, prefix: string, prop: string, value: string) => {
      if (BLOCKED_CSS_PROP.test(prop) || BLOCKED_CSS_VALUE.test(value)) return prefix
      return match
    })
    .replace(/;\s*;/g, ';')
}

function escapeSvelteTextExpressions(content: string) {
  let out: string[] = []
  let quote = ''
  let inTag = false

  for (let i = 0; i < content.length; i++) {
    if (!inTag && /^<script(?:\s|>)/i.test(content.slice(i))) {
      let end = content.slice(i).search(/<\/script>/i)
      if (end != -1) {
        let closeEnd = i + end + content.slice(i + end).match(/^<\/script>/i)![0].length
        out.push(content.slice(i, closeEnd))
        i = closeEnd - 1
        continue
      }
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
      if (end != -1) {
        throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
      }
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

// We don't want users to have to manually import components in their md files, so we auto-import them.
export function injectComponentImports() {
  let imp = `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`

  return {
    markup: ({content, filename}: {content: string; filename: string}) => {
      if (!filename.endsWith('.md')) return // only auto-import components for md files
      content = liftInlineEChartsConfig(content)
      if (hasTemplateBlockOutsideTags(content.replace(/<script[\s\S]*?<\/script>/gi, ''))) throw new Error('Dynamic markup expressions are not supported in Graphene markdown.')
      let pageStyles = extractPageStyles(content)
      content = escapeSvelteTextExpressions(pageStyles.html)
      if (pageStyles.css.trim()) content = `<svelte:head><style>${pageStyles.css}</style></svelte:head>\n${content}`
      if (content.includes('<script>')) {
        content = content.replace('<script>', `<script>\n${imp}`)
      } else {
        content = `<script>\n${imp}\n</script>\n${content}`
      }
      return {code: content}
    },
    style: () => {},
    script: () => {},
  }
}

// List out the component names from ui/components
let cachedComponentNames: string[] | null = null
export function componentNames() {
  if (cachedComponentNames) return cachedComponentNames

  let files = fs.readdirSync(path.join(import.meta.dirname, '../ui/components'))
  cachedComponentNames = files.map(f => path.basename(f, '.svelte')).filter(f => !f.startsWith('_'))
  return cachedComponentNames || []
}

export type PageFrontmatter = {title?: string}

// Parse YAML frontmatter from the --- delimited block at the top of a markdown file.
const frontmatterRe = /^---\s*\n([\s\S]*?)\n---(?:\n|$)/
export function extractFrontmatter(contents: string): PageFrontmatter {
  let match = contents.trimStart().match(frontmatterRe)
  if (!match) return {}
  let raw = yaml.safeLoad(match[1]) as Record<string, any> | undefined
  return {title: raw?.title ? String(raw.title) : undefined}
}

export const remarkPlugins: Array<Plugin> = [extractQueries, escapeAngles, mergeAdjacentHtml]
export const rehypePlugins: Array<Plugin> = [sanitizeMarkdown]
