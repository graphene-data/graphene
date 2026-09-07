import type {Plugin} from 'unified'

import {decodeHTML} from 'entities'
import fs from 'fs'
import yaml from 'js-yaml'
import JSON5 from 'json5'
import path from 'path'
import {visit} from 'unist-util-visit'

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

// We don't want users to have to manually import components in their md files, so we auto-import them.
export function injectComponentImports() {
  let imp = `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`

  return {
    markup: ({content, filename}: {content: string; filename: string}) => {
      if (!filename.endsWith('.md')) return // only auto-import components for md files
      content = liftInlineEChartsConfig(content)
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

export type PageFrontmatter = {title?: string; hideInNav?: boolean; layout?: string; scheduled?: string}
export interface ScheduledFrontmatter {cron: string; remainder: string}

const frontmatterRe = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const legacyScheduleRe = /^scheduled\s*:\s*"([^"\r\n]+)"\s+([^\r\n]+)$/gim

// Load standard YAML after rewriting the former `scheduled: "<cron>" <delivery>` extension into its valid YAML equivalent.
function parseFrontmatterYaml(frontmatter: string): Record<string, any> {
  let legacySchedules = [...frontmatter.matchAll(legacyScheduleRe)].map(match => `${match[1]} ${match[2].trim()}`)
  if (legacySchedules.length) {
    let replacement = legacySchedules.length === 1
      ? `scheduled: ${JSON.stringify(legacySchedules[0])}`
      : `scheduled:\n${legacySchedules.map(value => `  - ${JSON.stringify(value)}`).join('\n')}`
    let replacedFirst = false
    frontmatter = frontmatter.replace(legacyScheduleRe, () => {
      if (replacedFirst) return ''
      replacedFirst = true
      return replacement
    })
  }

  let raw = yaml.safeLoad(frontmatter)
  if (raw === undefined) return {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Frontmatter must be a YAML object')
  return raw as Record<string, any>
}

function parseFrontmatter(contents: string): Record<string, any> {
  let frontmatter = contents.trimStart().match(frontmatterRe)?.[1]
  return frontmatter ? parseFrontmatterYaml(frontmatter) : {}
}

// mdsvex uses the same parser so legacy schedules remain renderable while all other frontmatter follows YAML.
export const frontmatterOptions = {type: 'yaml', marker: '-', parse: parseFrontmatterYaml}

// Parse all schedules from a page after normalizing its frontmatter.
export function parseScheduledFrontmatter(contents: string): ScheduledFrontmatter[] {
  return parseScheduledValue(parseFrontmatter(contents).scheduled)
}

// Parse one schedule string or a YAML list. Core validates the five-field cron and leaves any trailing syntax to Cloud.
function parseScheduledValue(scheduled: unknown): ScheduledFrontmatter[] {
  if (scheduled === undefined) return []
  let values: unknown[] = Array.isArray(scheduled) ? scheduled : [scheduled]
  if (!values.every((value): value is string => typeof value === 'string')) throw new Error('Scheduled reports must be strings')

  return values.map(value => {
    let parts = value.trim().split(/\s+/)
    if (parts.length < 5) throw new Error('Invalid scheduled report: expected a five-field cron')
    let cron = parts.slice(0, 5).join(' ')
    parseCronFieldSet(cron)
    return {cron, remainder: parts.slice(5).join(' ')}
  })
}

// Parse cron fields once for both frontmatter validation and Cloud's UTC schedule matching.
export function parseCronFieldSet(cron: string) {
  let fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`Invalid cron "${cron}": expected five fields`)
  return [
    parseCronField(fields[0], 0, 59),
    parseCronField(fields[1], 0, 23),
    parseCronField(fields[2], 1, 31),
    parseCronField(fields[3], 1, 12),
    parseCronField(fields[4], 0, 7, true),
  ] as const
}

function parseCronField(field: string, min: number, max: number, sunday = false) {
  let values = new Set<number>()
  for (let part of field.split(',')) {
    if (!/^(?:\*|\d+|\d+-\d+)(?:\/\d+)?$/.test(part)) throw new Error(`Invalid cron field "${field}"`)
    let [range, rawStep] = part.split('/')
    let step = rawStep === undefined ? 1 : Number(rawStep)
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron field "${field}"`)

    let start: number
    let end: number
    if (range === '*') [start, end] = [min, max]
    else if (range.includes('-')) [start, end] = range.split('-').map(Number)
    else [start, end] = [Number(range), rawStep === undefined ? Number(range) : max]
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw new Error(`Invalid cron field "${field}"`)
    for (let value = start; value <= end; value += step) values.add(sunday && value === 7 ? 0 : value)
  }
  return {values, restricted: values.size !== (sunday ? 7 : max - min + 1)}
}

// Extract supported frontmatter without compiling the page. When frontmatter omits a title,
// use the first static Markdown h1 so every caller gets the same page metadata.
export function extractFrontmatter(contents: string): PageFrontmatter {
  let raw = parseFrontmatter(contents)
  let schedules = parseScheduledValue(raw.scheduled)
  let metadata: PageFrontmatter = {}

  if (raw.title) metadata.title = String(raw.title)
  else {
    let markdownTitle = contents.match(/^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m)?.[1]?.trim()
    if (markdownTitle && !/[<{]/.test(markdownTitle)) metadata.title = markdownTitle
  }
  if (raw.hideInNav === true) metadata.hideInNav = true
  if (raw.layout) metadata.layout = String(raw.layout)
  if (schedules.length) metadata.scheduled = Array.isArray(raw.scheduled) ? raw.scheduled[0] : raw.scheduled
  return metadata
}

export const remarkPlugins: Array<Plugin> = [extractQueries, escapeAngles]
export const rehypePlugins: Array<Plugin> = []
