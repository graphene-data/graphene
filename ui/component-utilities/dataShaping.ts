import type {Field, NormalConfig, SeriesWithGroupingHint} from './types.ts'

// Fill sparse grouped data so each split series has a value for each x bucket.
//
// This only applies to split templates (`encode.splitBy`).
// We do not attempt to fabricate x values here; we only ensure a full Cartesian
// product of existing x values and split values.
//
// Missing-value behavior by chart type (Evidence defaults):
// - line (no area): null  -> visible line gaps
// - area (line + areaStyle):
//   - stacked area: 0 -> continuous stacked area baseline
//   - unstacked area: null -> visible gaps like line charts
// - bar: 0 -> missing category bars render as zero-height bars
export function applyMissingPointDefaults(config: NormalConfig, rows: Record<string, any>[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  let groups = new Map<string, {xField: string; splitFields: string[]; fills: Map<string, any>}>()

  for (let entry of series) {
    let splitFields = getSplitFields(entry)
    let xField = getSeriesXField(entry)
    let yField = getSeriesYField(entry)
    if (splitFields.length === 0 || !xField || !yField) continue

    let key = `${xField}::${splitFields.join('::')}`
    if (!groups.has(key)) groups.set(key, {xField, splitFields, fills: new Map()})

    // This line is where chart-specific missing-value behavior is chosen.
    // See getMissingFillValueForSeries() below for the type mapping.
    let fillValue = getMissingFillValueForSeries(entry)
    let fills = groups.get(key)!.fills

    // If multiple templates target the same y field, prefer zero over null.
    // (bar/area should win over plain line when mixed configs exist.)
    if (!fills.has(yField) || fillValue === 0) fills.set(yField, fillValue)
  }

  for (let group of groups.values()) {
    let xValues = distinctValues(rows, group.xField)
    let splitValues = group.splitFields.map(field => distinctValues(rows, field))
    if (xValues.length === 0 || splitValues.some(values => values.length === 0)) continue

    let existing = new Set<string>()
    for (let row of rows) {
      existing.add(compositeKey([row?.[group.xField], ...group.splitFields.map(field => row?.[field])]))
    }

    for (let xValue of xValues) {
      for (let splitCombination of cartesianValues(splitValues)) {
        if (existing.has(compositeKey([xValue, ...splitCombination]))) continue

        let row: Record<string, any> = {[group.xField]: xValue}
        group.splitFields.forEach((field, index) => {
          row[field] = splitCombination[index]
        })
        for (let [yField, fillValue] of group.fills.entries()) row[yField] = fillValue
        rows.push(row)
      }
    }
  }
}

// Evidence stacked100 behavior: compute percentages per x-domain and rewrite series to synthetic pct fields.
export function applyStackPercentage(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  let groupIndex = 0

  for (let entry of series) {
    let xField = getSeriesXField(entry)
    let yField = getSeriesYField(entry)
    if (entry?.stackPercentage !== true || !entry?.stack || !xField || !yField || entry?.datasetId != null) continue

    let stackGroup = series.filter(candidate => {
      return candidate?.stack === entry.stack && getSeriesXField(candidate) === xField && getSeriesYField(candidate)
    })
    if (stackGroup[0] !== entry) continue

    let yFields = Array.from(new Set(stackGroup.map(candidate => getSeriesYField(candidate)).filter(Boolean))) as string[]
    let pctFieldByY = Object.fromEntries(yFields.map((y, index) => [y, `__graphene_stack_pct_${groupIndex}_${index}`])) as Record<string, string>

    let totalsByX = new Map<string, number>()
    for (let row of rows) {
      let xKey = valueKey(row?.[xField])
      let rowTotal = yFields.reduce((sum, y) => sum + (Number(row?.[y]) || 0), 0)
      totalsByX.set(xKey, (totalsByX.get(xKey) ?? 0) + rowTotal)
    }

    for (let row of rows) {
      let xKey = valueKey(row?.[xField])
      let total = totalsByX.get(xKey) ?? 0
      for (let y of yFields) row[pctFieldByY[y]] = total <= 0 ? 0 : (Number(row?.[y]) || 0) / total
    }

    for (let y of yFields) ensureField(fields, pctFieldByY[y], {metadata: {ratio: true}})

    for (let candidate of stackGroup) {
      let y = getSeriesYField(candidate)
      if (!y) continue
      candidate.encode = {...candidate.encode, y: pctFieldByY[y]}
      delete candidate.stackPercentage
    }

    groupIndex++
  }
}

// Sort rows with either an explicit `encode.sort` rule or our built-in defaults.
// Explicit sort format: "column" or "column asc|desc".
export function applySorting(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  // Explicit sort always wins and only applies to categorical axes.
  let explicitSort = resolveExplicitSort(series, fields)
  let categoryField = [...config.xAxis, ...config.yAxis].find(axis => axis?.type === 'category')?.field?.name
  if (explicitSort) {
    if (!categoryField) throw new Error('sort is only supported when the chart has a categorical axis')
    sortCategoriesByField(rows, categoryField, explicitSort.field, explicitSort.direction, fields)
    return
  }

  let primaryXField = config.xAxis[0]?.field
  if (!primaryXField) return

  // time/value x fields keep natural ascending order
  if (primaryXField.type === 'date' || primaryXField.type === 'timestamp' || primaryXField.type === 'number') {
    sortRowsByXAscending(rows, primaryXField.name, primaryXField.type === 'number' ? 'number' : 'date')
    return
  }

  if (primaryXField.type !== 'string') return

  let primarySeries = series.filter(entry => getSeriesXField(entry) === primaryXField.name && getSeriesYField(entry))
  if (primarySeries.length === 0) return

  let hasStackedBars = primarySeries.some(entry => entry?.type === 'bar' && (!!entry?.stack || getSplitFields(entry).length === 2))
  if (hasStackedBars) {
    let yFields = Array.from(new Set(primarySeries.map(entry => getSeriesYField(entry)).filter(Boolean))) as string[]
    sortCategoriesByValue(rows, primaryXField.name, row => yFields.reduce((sum, y) => sum + (Number(row?.[y]) || 0), 0), 'desc')
    return
  }

  let firstY = getSeriesYField(primarySeries[0])
  if (!firstY) return
  sortCategoriesByValue(rows, primaryXField.name, row => Number(row?.[firstY]) || 0, 'desc')
}

// Materialize dataset-backed bar series into explicit point arrays so later enrichments can mutate points.
// This is needed to round the corners of bars, which can only be done with point-level item styles.
export function inlineDataIntoSeries(config: NormalConfig, rows: Record<string, any>[]) {
  let horizontal = isHorizontalBar(config)
  let datasetsById = new Map<string, Record<string, any>>()
  for (let dataset of config.dataset) {
    if (!dataset?.id) continue
    datasetsById.set(String(dataset.id), dataset as Record<string, any>)
  }

  let memo = new Map<string, Record<string, any>[] | null>()
  let datasetRows = (datasetId?: string): Record<string, any>[] | null => {
    if (!datasetId) return rows
    if (memo.has(datasetId)) return memo.get(datasetId) ?? null

    let dataset = datasetsById.get(datasetId)
    if (!dataset) return null

    if (Array.isArray(dataset.source)) {
      memo.set(datasetId, dataset.source as Record<string, any>[])
      return dataset.source as Record<string, any>[]
    }

    let parentId = dataset.fromDatasetId != null ? String(dataset.fromDatasetId) : undefined
    if (!parentId) return null

    let parentRows = datasetRows(parentId)
    if (!parentRows) return null

    let transform = dataset.transform as Record<string, any> | undefined
    if (transform?.type !== 'filter') return null

    let filterConfig = transform.config as Record<string, any> | undefined
    let filterField = filterConfig?.dimension
    if (typeof filterField !== 'string' || !filterConfig || !Object.prototype.hasOwnProperty.call(filterConfig, '=')) return null

    let filtered = parentRows.filter(row => row?.[filterField] === filterConfig['='])
    memo.set(datasetId, filtered)
    return filtered
  }

  for (let series of config.series) {
    if (series?.type !== 'bar' || !series?.stack || series?.data != null) continue

    let xField = getSeriesXField(series)
    let yField = getSeriesYField(series)
    let categoryField = horizontal ? yField : xField
    if (!xField || !yField || !categoryField) continue

    let seriesRows = datasetRows(series.datasetId)
    if (!seriesRows) continue

    let rowByCategory = new Map<string, Record<string, any>>()
    for (let row of seriesRows) {
      let key = valueKey(row?.[categoryField])
      if (!rowByCategory.has(key)) rowByCategory.set(key, row)
    }

    let categories = distinctValues(rows, categoryField)
    series.data = categories.map(categoryValue => {
      let sourceRow = rowByCategory.get(valueKey(categoryValue))!
      return {...sourceRow, value: [sourceRow[xField], sourceRow[yField]]}
    })
    delete series.datasetId
  }
}

function sortRowsByXAscending(rows: Record<string, any>[], xField: string, xType: 'date' | 'number') {
  let indexed = rows.map((row, index) => ({row, index}))
  indexed.sort((a, b) => {
    let aValue = sortableValue(a.row?.[xField], xType)
    let bValue = sortableValue(b.row?.[xField], xType)
    if (aValue < bValue) return -1
    if (aValue > bValue) return 1
    return a.index - b.index
  })
  for (let i = 0; i < indexed.length; i++) rows[i] = indexed[i].row
}

// Aggregate one numeric value per category, then order categories by that value.
function sortCategoriesByValue(rows: Record<string, any>[], categoryField: string, metricForRow: (row: Record<string, any>) => number, direction: 'asc' | 'desc') {
  let metricByCategory = new Map<string, number>()

  for (let row of rows) {
    let key = valueKey(row?.[categoryField])
    metricByCategory.set(key, (metricByCategory.get(key) ?? 0) + metricForRow(row))
  }

  let orderedCategoryKeys = Array.from(metricByCategory.keys())
  orderedCategoryKeys.sort((left, right) => {
    let leftMetric = metricByCategory.get(left) ?? 0
    let rightMetric = metricByCategory.get(right) ?? 0
    return direction === 'asc' ? leftMetric - rightMetric : rightMetric - leftMetric
  })

  sortRowsByCategoryOrder(rows, categoryField, orderedCategoryKeys)
}

// Sort categories by a specific field.
// Numeric fields are summed per category; non-numeric fields use first value seen.
function sortCategoriesByField(rows: Record<string, any>[], categoryField: string, sortField: string, direction: 'asc' | 'desc', fields: Field[]) {
  let sortType = inferFieldType(fields, sortField)

  if (sortType === 'number') {
    sortCategoriesByValue(rows, categoryField, row => Number(row?.[sortField]) || 0, direction)
    return
  }

  let sortValueByCategory = new Map<string, unknown>()
  for (let row of rows) {
    let key = valueKey(row?.[categoryField])
    if (sortValueByCategory.has(key)) continue
    sortValueByCategory.set(key, row?.[sortField])
  }

  let orderedCategoryKeys = distinctValues(rows, categoryField).map(value => valueKey(value))
  orderedCategoryKeys.sort((left, right) => {
    let leftValue = sortValueByCategory.get(left)
    let rightValue = sortValueByCategory.get(right)

    if (sortType === 'date') {
      let leftDate = sortableValue(leftValue, 'date')
      let rightDate = sortableValue(rightValue, 'date')
      return direction === 'asc' ? leftDate - rightDate : rightDate - leftDate
    }

    let comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''), undefined, {numeric: true})
    return direction === 'asc' ? comparison : -comparison
  })

  sortRowsByCategoryOrder(rows, categoryField, orderedCategoryKeys)
}

// Apply a category order while preserving original row order within each category.
function sortRowsByCategoryOrder(rows: Record<string, any>[], categoryField: string, orderedCategoryKeys: string[]) {
  let positionByCategory = new Map<string, number>(orderedCategoryKeys.map((key, index) => [key, index]))
  let indexed = rows.map((row, index) => ({row, index}))

  indexed.sort((left, right) => {
    let leftPos = positionByCategory.get(valueKey(left.row?.[categoryField])) ?? Number.MAX_SAFE_INTEGER
    let rightPos = positionByCategory.get(valueKey(right.row?.[categoryField])) ?? Number.MAX_SAFE_INTEGER
    if (leftPos !== rightPos) return leftPos - rightPos
    return left.index - right.index
  })

  for (let i = 0; i < indexed.length; i++) rows[i] = indexed[i].row
}

function ensureField(fields: Field[], name: string, options?: Partial<Field>) {
  if (fields.some(field => field.name === name)) return
  fields.push({name, type: 'number', ...options})
}

// Default missing datapoint handling differs by chart type.
// - bar: missing grouped points become 0
// - area: stacked -> 0, unstacked -> null (gap)
// - line: missing grouped points become null (shows a gap unless connectNulls is enabled)
function getMissingFillValueForSeries(series: SeriesWithGroupingHint) {
  if (series?.type === 'bar') return 0

  let isArea = series?.type === 'line' && series?.areaStyle != null
  if (isArea && series?.stack) return 0

  return null
}

function inferFieldType(fields: Field[], fieldName: string) {
  let field = fields.find(entry => entry.name === fieldName)
  if (!field) return 'string'
  if (typeof field.type !== 'string') throw new Error(`Field ${fieldName} has unsupported non-scalar type: array`)
  if (field.type === 'date' || field.type === 'timestamp') return 'date'
  if (field.type === 'number') return 'number'
  return 'string'
}

function resolveExplicitSort(series: SeriesWithGroupingHint[], fields: Field[]) {
  let specs = Array.from(
    new Set(
      series
        .map(entry => entry?.encode?.sort)
        .filter(value => typeof value === 'string')
        .map(value => String(value)),
    ),
  )
  if (specs.length === 0) return undefined
  if (specs.length > 1) throw new Error('sort must be the same across all series')

  let parsed = parseSortSpec(specs[0])
  if (!fields.some(field => field.name === parsed.field))
    throw new Error(`${parsed.field} is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).`)
  return parsed
}

function parseSortSpec(sort: string): {field: string; direction: 'asc' | 'desc'} {
  let parts = sort.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0 || parts.length > 2) throw new Error('sort should contain one column name and optionally a direction (asc or desc).')

  let field = parts[0]
  let direction = parts[1]?.toLowerCase()
  if (!field) throw new Error('sort should contain one column name and optionally a direction (asc or desc).')
  if (!direction) return {field, direction: 'asc'}
  if (direction !== 'asc' && direction !== 'desc') throw new Error('sort should contain one column name and optionally a direction (asc or desc).')
  return {field, direction}
}

function getSplitFields(series: SeriesWithGroupingHint) {
  let splitBy = series?.encode?.splitBy
  if (typeof splitBy === 'string') return [splitBy]
  if (!Array.isArray(splitBy)) return []
  return splitBy
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
}

function isHorizontalBar(config: NormalConfig) {
  let xAxis = config.xAxis[0]
  let yAxis = config.yAxis[0]
  let hasBarSeries = config.series.some(series => series?.type === 'bar')
  return Boolean(hasBarSeries && xAxis?.type === 'value' && yAxis?.type === 'category')
}

function getSeriesXField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.x)
}

function getSeriesYField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y) ?? getEncodeField(series?.encode?.value)
}

function getEncodeField(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find(entry => typeof entry === 'string')
  return undefined
}

function distinctValues(rows: Record<string, any>[], field: string) {
  let values: unknown[] = []
  let seen = new Set<string>()
  for (let row of rows) {
    let value = row?.[field]
    let key = valueKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    values.push(value)
  }
  return values
}

function sortableValue(value: unknown, type: 'date' | 'number') {
  if (type === 'number') {
    let parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
  }
  let timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''))
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function cartesianValues(valueLists: unknown[][]) {
  if (valueLists.length === 0) return [[]] as unknown[][]

  return valueLists.reduce<unknown[][]>(
    (acc, values) => {
      let next: unknown[][] = []
      for (let prefix of acc) {
        for (let value of values) next.push([...prefix, value])
      }
      return next
    },
    [[]],
  )
}

function compositeKey(values: unknown[]) {
  return values.map(value => valueKey(value)).join('|')
}

function valueKey(value: unknown) {
  return JSON.stringify(value ?? null)
}
