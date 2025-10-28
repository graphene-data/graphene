import fs from 'fs'
import path from 'path'
import {visit} from 'unist-util-visit'
import sanitizeHtml from 'sanitize-html'


export function extractQueries () {
  function escapeHtml (str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  return function transformer (tree) {
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
  return function transformer (tree) {
    visit(tree, 'text', (node: any) => {
      if (!node.value || typeof node.value !== 'string') return
      if (!node.value.includes('<')) return
      node.value = node.value.replace(/</g, '&lt;')
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
      let expanded = node.value.replace(/<(\w+)((?:\s[^<>]*?)?)\s*\/>/gi, (_, name, attrs = '') => {
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
          ...(sanitizeHtml.defaults.parser || {}),
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
    markup: ({content, filename}) => {
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
