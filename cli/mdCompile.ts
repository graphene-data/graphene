import fs from 'fs'
import path from 'path'
import type {Plugin} from 'unified'
import {visit} from 'unist-util-visit'
import sanitizeHtml from 'sanitize-html'


export function extractQueries () {
  function escapeHtml (str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  return function transformer (tree: any) {
    visit(tree, 'code', (node, index, parent) => {
      if (index === null) return
      let name = typeof node.meta === 'string' ? node.meta : ''
      let code = typeof node.value === 'string' ? node.value.trim() : ''
      parent.children[index] = {type: 'html', value: `<GrapheneQuery name="${escapeHtml(name)}" code="${escapeHtml(code)}" />`}
    })
  }
}

// remark will leave less-than and greater-than unescaped, which breaks svelte and prevents the page from loading.
export function escapeAngles () {
  return function transformer (tree: any) {
    visit(tree, 'text', (node: any) => {
      if (!node.value || typeof node.value !== 'string') return
      if (!node.value.includes('<')) return
      node.value = node.value.replace(/</g, '&lt;')
    })
  }
}

// remark can split one html block into adjacent html nodes when self-closing tags are involved.
// Merge those sibling html nodes so downstream rehype/sanitize work on the full block.
export function mergeAdjacentHtml () {
  return function transformer (tree: any) {
    visit(tree, (parent: any) => {
      if (!Array.isArray(parent?.children)) return

      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i]?.type !== 'html') continue

        let j = i
        while (j + 1 < parent.children.length && parent.children[j + 1]?.type === 'html') j++
        if (j == i) continue

        let value = parent.children.slice(i, j + 1).map((node: any) => node.value || '').join('\n')
        parent.children.splice(i, j - i + 1, {type: 'html', value})
      }
    })
  }
}

// Restrict allowed components in markdown files to avoid xss issues.
// This uses sanitize-html rather than rehype-sanitize because the latter had lots of issues with preserving tag casing,
// as well as allowing all attributes on our allowlisted components.
export function sanitizeMarkdown () {
  return function transformer (tree: any) {
    visit(tree, 'raw', (node: any) => {
      if (typeof node.value !== 'string') return

      // sanitize-html doesn't like non-standard self-closing tags, so we need to rewrite them into open+close tags
      let expanded = node.value.replace(/<(\w+)((?:\s[^<>]*?)?)\s*\/>/gi, (_: string, name: string, attrs = '') => {
        let spacing = attrs
        return `<${name}${spacing}></${name}>`
      })

      let sanitized = sanitizeHtml(expanded, {
        ...sanitizeHtml.defaults,
        allowedTags: [
          ...sanitizeHtml.defaults.allowedTags,
          ...componentNames(),
        ],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          ...Object.fromEntries(componentNames().map(n => [n, ['*']])),
        },
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

// We don't want users to have to manually import components in their md files, so we auto-import them.
export function injectComponentImports () {
  let imp = `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`

  return {
    markup: ({content, filename}: {content: string, filename: string}) => {
      if (!filename.endsWith('.md')) return // only auto-import components for md files
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
export function componentNames () {
  if (cachedComponentNames) return cachedComponentNames

  let files = fs.readdirSync(path.join(import.meta.dirname, '../ui/components'))
  cachedComponentNames = files.map(f => path.basename(f, '.svelte')).filter(f => !f.startsWith('_'))
  return cachedComponentNames || []
}

export const remarkPlugins: Array<Plugin> = [extractQueries, escapeAngles, mergeAdjacentHtml];
export const rehypePlugins: Array<Plugin> = [sanitizeMarkdown];