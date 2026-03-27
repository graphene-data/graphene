<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2, Field} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    y2?: string
    group?: string
    stack?: string | boolean
    labels?: boolean | string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    y2 = undefined,
    group = undefined,
    stack = false,
    labels = false,
    title = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(fields: Field[]): EChartsConfig2 {
    let yFields = parseList(y)
    let xFieldType = getFieldType(fields, x)
    let yFieldType = yFields.length === 1 ? getFieldType(fields, yFields[0]) : 'number'
    let horizontal = yFields.length === 1 && isNumericOrDate(xFieldType) && yFieldType !== 'number'

    let categoryField = horizontal ? yFields[0] : x
    let valueField = horizontal ? x : y
    let valueAxisType = horizontal && xFieldType === 'date' ? 'time' : 'value'
    let stackKey = resolveStack(stack)

    let series = group && yFields.length === 1
      ? [{type: 'bar', data: yFields[0], series: group, stack: stackKey, label: parseBool(labels) ? {show: true} : undefined}]
      : yFields.map(field => ({type: 'bar', data: field, name: field, stack: stackKey, label: parseBool(labels) ? {show: true} : undefined}))

    if (y2) series.push({type: 'line', data: y2, name: y2, yAxisIndex: 1})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(group || yFields.length > 1 || y2)},
      xAxis: horizontal ? {type: valueAxisType} : {type: 'category', data: categoryField},
      yAxis: horizontal
        ? [{type: 'category', data: categoryField}, ...(y2 ? [{type: 'value'}] : [])]
        : [{type: 'value'}, ...(y2 ? [{type: 'value'}] : [])],
      series,
    }
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }

  function parseBool(value: unknown) {
    if (value === undefined || value === null) return false
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return Boolean(value)
  }

  function resolveStack(value?: string | boolean) {
    if (!value) return undefined
    if (typeof value === 'string') return value
    return 'bar-stack'
  }

  function getFieldType(fields: Field[], fieldName: string) {
    let field = fields.find(entry => entry.name === fieldName)
    return field?.evidenceType ?? field?.type ?? 'unknown'
  }

  function isNumericOrDate(type: string) {
    return type === 'number' || type === 'date' || type === 'timestamp'
  }
</script>

{#snippet barChartContent(result)}
  <ECharts2 config={buildConfig(result.fields)} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), y2, group}} children={barChartContent} />
