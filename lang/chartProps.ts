export interface UnsupportedChartProp {
  componentName: string
  prop: string
  message: string
}

export const CHART_COMPONENT_PROPS: Record<string, readonly string[]> = {
  BarChart: ['data', 'x', 'y', 'y2', 'splitBy', 'arrange', 'label', 'sort', 'title', 'height', 'width'],
  LineChart: ['data', 'x', 'y', 'y2', 'splitBy', 'sort', 'title', 'height', 'width'],
  AreaChart: ['data', 'x', 'y', 'y2', 'splitBy', 'arrange', 'sort', 'title', 'height', 'width'],
  PieChart: ['data', 'category', 'value', 'title', 'subtitle', 'height', 'width'],
  ECharts: ['data', 'config', 'height', 'width', 'renderer'],
}

const OBSOLETE_PROP_MESSAGES: Record<string, string> = {
  series: 'Use splitBy instead.',
  chartAreaHeight: 'Use height instead.',
  swapXY: 'Swap the x and y mappings for horizontal bars instead.',
  xFmt: 'Use field metadata or ECharts for custom formatting.',
  yFmt: 'Use field metadata or ECharts for custom formatting.',
  y2Fmt: 'Use field metadata or ECharts for custom formatting.',
  subtitle: 'subtitle is only valid on PieChart. Use ECharts for chart subtext.',
  emptySet: 'emptySet is not supported on chart wrappers.',
  emptyMessage: 'emptyMessage is not supported on chart wrappers.',
}

const INTERNAL_PROPS = new Set(['children', '$$slots', '$$events', '$$legacy'])

export function unsupportedChartProps(componentName: string, props: Record<string, unknown>): UnsupportedChartProp[] {
  let allowed = CHART_COMPONENT_PROPS[componentName]
  if (!allowed) return []

  let allowedSet = new Set(allowed)
  return Object.keys(props)
    .filter(prop => !INTERNAL_PROPS.has(prop) && !allowedSet.has(prop))
    .map(prop => ({componentName, prop, message: unsupportedChartPropMessage(componentName, prop, props[prop])}))
}

export function unsupportedChartPropMessage(componentName: string, prop: string, value?: unknown) {
  return `Unsupported prop "${prop}" on ${componentName}. ${unsupportedChartPropHint(prop, value)}`
}

function unsupportedChartPropHint(prop: string, value?: unknown) {
  if (prop == 'type' && value == 'stacked100') return 'Use arrange="stack100" instead.'
  return OBSOLETE_PROP_MESSAGES[prop] || 'Use ECharts for custom chart configuration.'
}
