export type ExtractSeriesPoint = {
  x: any
  y: number | null
  row: Record<string, any>
}

export type CartesianFrameSeries = {
  id: string
  name: string
  dims: Record<string, any>
  points: ExtractSeriesPoint[]
}

export type CartesianFrameOptions = {
  x: string
  y: string
  splitBy?: string[]
  xAxisType: 'category' | 'value' | 'time'
  orderX?: 'input' | 'asc' | 'desc'
  orderSeries?: 'input' | 'asc' | 'desc'
  complete?: boolean
  reduce?: 'sum' | 'first' | 'last'
}

export type CartesianFrame = {
  xDomain: any[]
  series: CartesianFrameSeries[]
}

export type ExtractSeriesOptions<TSeries> = {
  x: string
  y: string
  series?: string
  xAxisType: 'category' | 'value' | 'time'
  buildSeries: (seriesName: string, points: ExtractSeriesPoint[]) => TSeries
}

export type ExtractSeriesResult<TSeries> = {
  categories: any[]
  series: TSeries[]
}

// Build a reusable cartesian data frame that can be projected into different chart libraries.
// This function only handles data shaping concerns: grouping, ordering, dedupe reduction, and completion.
export function shapeCartesianFrame(rows: Record<string, any>[], options: CartesianFrameOptions): CartesianFrame {
  let splitBy = options.splitBy ?? []
  let orderX = options.orderX ?? 'input'
  let orderSeries = options.orderSeries ?? 'input'
  let complete = options.complete ?? options.xAxisType === 'category'
  let reduce = options.reduce ?? 'sum'

  let xDomain: any[] = []
  let xIndex = new Map<any, number>()
  let grouped = new Map<string, {name: string; dims: Record<string, any>; values: Map<any, {y: number | null; row: Record<string, any>}>}>()

  for (let row of rows) {
    let x = row[options.x]
    if (!xIndex.has(x)) {
      xIndex.set(x, xDomain.length)
      xDomain.push(x)
    }

    let dims = Object.fromEntries(splitBy.map(field => [field, row[field]]))
    let seriesName = splitBy.length === 0 ? options.y : splitBy.map(field => String(row[field] ?? '')).join(' / ')
    let seriesId = splitBy.length === 0 ? '__single__' : splitBy.map(field => JSON.stringify(row[field] ?? null)).join('|')

    if (!grouped.has(seriesId)) grouped.set(seriesId, {name: seriesName, dims, values: new Map()})
    let group = grouped.get(seriesId)
    if (!group) continue

    let nextValue = toNumericOrNull(row[options.y])
    let previous = group.values.get(x)
    if (!previous) {
      group.values.set(x, {y: nextValue, row})
      continue
    }

    group.values.set(x, {y: reduceNumeric(previous.y, nextValue, reduce), row})
  }

  let sortedDomain = [...xDomain]
  if (orderX !== 'input') sortedDomain.sort((a, b) => compareValues(a, b) * (orderX === 'asc' ? 1 : -1))

  let series = Array.from(grouped.entries()).map(([id, group]) => {
    let points = complete
      ? sortedDomain.map(x => {
        let value = group.values.get(x)
        return value ? {x, y: value.y, row: value.row} : {x, y: null, row: {}}
      })
      : Array.from(group.values.entries())
        .map(([x, value]) => ({x, y: value.y, row: value.row}))
        .sort((a, b) => compareValues(a.x, b.x))

    return {id, name: group.name, dims: group.dims, points}
  })

  if (orderSeries !== 'input') series.sort((a, b) => a.name.localeCompare(b.name) * (orderSeries === 'asc' ? 1 : -1))

  return {xDomain: sortedDomain, series}
}

// Backwards-compatible adapter for current ECharts2 usage.
export function extractSeries<TSeries>(rows: Record<string, any>[], options: ExtractSeriesOptions<TSeries>): ExtractSeriesResult<TSeries> {
  let frame = shapeCartesianFrame(rows, {
    x: options.x,
    y: options.y,
    splitBy: options.series ? [options.series] : [],
    xAxisType: options.xAxisType,
    complete: options.xAxisType === 'category',
  })

  let series = frame.series.map(group => options.buildSeries(group.name, group.points))
  let categories = options.xAxisType === 'category' ? frame.xDomain : []
  return {categories, series}
}

function toNumericOrNull(value: any) {
  return Number.isFinite(value) ? value : null
}

function reduceNumeric(current: number | null, next: number | null, mode: 'sum' | 'first' | 'last') {
  if (mode === 'first') return current
  if (mode === 'last') return next
  if (current == null) return next
  if (next == null) return current
  return current + next
}

function compareValues(a: any, b: any) {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1

  if (a instanceof Date || b instanceof Date) return Number(new Date(a)) - Number(new Date(b))
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, {numeric: true})
}
