import type {Plugin} from 'unified'

import {decodeHTML} from 'entities'
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import {visit} from 'unist-util-visit'

import {extractPageStyles, replaceRawTagBlocks, validateSvelteMarkup} from './sanitization.ts'

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

// Takes the contents of a <ECharts> tag and lifts it into a Svelte expression prop.
// The body is JavaScript, not JSON, so formatter callbacks and other functions survive.
export function liftInlineEChartsConfig(content: string) {
  return replaceRawTagBlocks(content, 'ECharts', block => {
    let attrs = block.openTag.slice('<ECharts'.length, -1)
    let inline = block.body.trim()
    if (!inline) return block.raw
    if (/\sconfig\s*=/.test(attrs)) return block.raw
    let source = inline.startsWith('{') ? inline : `{${inline}}`
    let config = decodeHTML(source)
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
// Merge those sibling html nodes so downstream mdsvex sees the full block.
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

// We don't want users to have to manually import components in their md files, so we auto-import them.
export function injectComponentImports() {
  let imp = `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`

  return {
    markup: ({content, filename}: {content: string; filename: string}) => {
      if (!filename.endsWith('.md')) return // only auto-import components for md files
      content = liftInlineEChartsConfig(content)
      let pageStyles = extractPageStyles(content)
      content = pageStyles.html
      if (pageStyles.css.trim()) content = `<svelte:head><style>${pageStyles.css}</style></svelte:head>\n${content}`
      if (content.includes('<script>')) {
        content = content.replace('<script>', `<script>\n${imp}\n`)
      } else {
        content = `<script>\n${imp}\n</script>\n${content}`
      }
      validateSvelteMarkup(content)
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
  cachedComponentNames = files
    .filter(f => f.endsWith('.svelte') || f.endsWith('.js'))
    .map(f => f.replace(/\.(?:svelte|js)$/, ''))
    .filter(f => !f.startsWith('_'))
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
export const rehypePlugins: Array<Plugin> = []
