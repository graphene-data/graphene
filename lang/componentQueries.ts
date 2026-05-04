import JSON5 from 'json5'

import {parseCommaList} from './inputUtils.ts'
import {collectSveltishOpeningTags, extractSveltishAttributes, sveltishAttributeValues, type SveltishIgnoredRange} from './sveltish.ts'
import {formatSourceLocation} from './util.ts'

export const MARKDOWN_COMPONENT_ATTRIBUTE_KEYS = ['x', 'y', 'y2', 'value', 'category', 'splitBy', 'sort'] as const
export type ComponentQueryAttributeKey = (typeof MARKDOWN_COMPONENT_ATTRIBUTE_KEYS)[number] | 'column' | 'dates' | 'label' | 'labelField' | 'optionLabel'

export interface ComponentRequest {
  componentId: string
  source: string
  fields: string[]
  location: string
}

export type ComponentQueryIgnoredRange = SveltishIgnoredRange

type ComponentQueryAttributes = Record<string, string | undefined>

const ECHARTS_TAG = /<ECharts\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/ECharts>/g

const CHART_COMPONENT_FIELD_KEYS: Record<string, ComponentQueryAttributeKey[]> = {
  BarChart: ['x', 'y', 'y2', 'splitBy', 'sort'],
  AreaChart: ['x', 'y', 'y2', 'splitBy', 'sort'],
  PieChart: ['category', 'value'],
  LineChart: ['x', 'y', 'y2', 'splitBy', 'sort'],
  ScatterPlot: ['x', 'y', 'splitBy'],
}

const DEFAULT_MARKDOWN_FIELD_KEYS: ComponentQueryAttributeKey[] = ['x', 'y', 'y2', 'value', 'category']

export function markdownComponentFieldKeys(componentName: string): ComponentQueryAttributeKey[] {
  return CHART_COMPONENT_FIELD_KEYS[componentName] || DEFAULT_MARKDOWN_FIELD_KEYS
}

export function collectComponentRequests(contents: string, ignoredRanges: ComponentQueryIgnoredRange[], mdPath: string): ComponentRequest[] {
  let requests: ComponentRequest[] = []
  for (let tag of collectSveltishOpeningTags(contents, ignoredRanges)) {
    let attrs = sveltishAttributeValues(extractSveltishAttributes(tag.fragment, tag.start))
    let source = attrs.data
    if (!source) continue
    let fields = componentQueryFields(tag.name, attrs)
    if (!fields) continue
    requests.push({componentId: componentId(tag.name, attrs), source, fields, location: formatSourceLocation(contents, mdPath, tag.start)})
  }

  ECHARTS_TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ECHARTS_TAG.exec(contents))) {
    let start = match.index || 0
    if (isInsideRange(start, ignoredRanges)) continue
    let fragment = `<ECharts${match[1] || ''}>`
    let attrs = sveltishAttributeValues(extractSveltishAttributes(fragment, start))
    if (!attrs.data) continue
    let fields = fieldsForEChartsBody(match[2] || '')
    requests.push({componentId: componentId('ECharts', attrs, fields), source: attrs.data, fields, location: formatSourceLocation(contents, mdPath, start)})
  }
  return dedupeRequests(requests)
}

function componentQueryFields(componentName: string, attrs: ComponentQueryAttributes): string[] | null {
  if (componentName == 'Table') return []

  let keys = componentQueryFieldKeys(componentName, attrs)
  if (!keys) return null

  return keys.flatMap(key => {
    let value = attrs[key]
    if (!value) return []
    if (key == 'sort') return [value.trim().split(/\s+/)[0]]
    if (key == 'x' || key == 'y' || key == 'y2') return parseCommaList(value)
    return [value]
  })
}

function fieldsForEChartsBody(body: string) {
  let config: any
  try {
    let source = body.trim().startsWith('{') ? body.trim() : `{${body.trim()}}`
    config = JSON5.parse(source)
  } catch {
    return []
  }
  let series = Array.isArray(config.series) ? config.series : [config.series]
  let fields: string[] = series.flatMap((s: any) =>
    Object.entries(s?.encode || {}).flatMap(([attr, value]) => {
      if (typeof value != 'string' || !value.trim()) return []
      if (attr == 'sort') return [value.trim().split(/\s+/)[0]]
      return [value.trim()]
    }),
  )
  return Array.from(new Set(fields.filter(Boolean)))
}

function componentQueryFieldKeys(componentName: string, attrs: ComponentQueryAttributes): ComponentQueryAttributeKey[] | null {
  if (CHART_COMPONENT_FIELD_KEYS[componentName]) return CHART_COMPONENT_FIELD_KEYS[componentName]
  if (componentName == 'BigValue') return ['value']
  if (componentName == 'Value') return ['column']
  if (componentName == 'DateRange') return ['dates']
  if (componentName != 'Dropdown') return null

  let labelKey: ComponentQueryAttributeKey = 'label'
  if (attrs.labelField) labelKey = 'labelField'
  else if (attrs.optionLabel) labelKey = 'optionLabel'
  return ['value', labelKey]
}

function componentId(componentName: string, attrs: ComponentQueryAttributes, echartFields?: string[]) {
  let ids: Record<string, any> = {}
  if (attrs.data) ids.data = attrs.data
  ;['x', 'y', 'category', 'value', 'column'].forEach(key => {
    if (attrs[key]) ids[key] = attrs[key]
  })
  if (componentName == 'ECharts') {
    echartFields?.forEach((field, index) => (ids[index == 0 ? 'field' : `field${index + 1}`] = field))
  }
  let parts = Object.entries(ids).map(([key, value]) => `${key}="${value}"`)
  return `${componentName}${parts.length ? ` (${parts.join(' ')})` : ''}`
}

function dedupeRequests(requests: ComponentRequest[]) {
  let seen = new Set<string>()
  return requests.filter(request => {
    let key = `${request.componentId}::${request.source}::${request.fields.join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isInsideRange(offset: number, ranges: ComponentQueryIgnoredRange[]) {
  return ranges.some(range => offset >= range.start && offset < range.end)
}
