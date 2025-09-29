import {strictBuild} from './chartContext.js'

type ColumnSummary = {
  id: string
  type?: string
  format?: any
  columnUnitSummary?: any
}

type ColumnOption = {
  id: string
}

type ColumnLike = ColumnOption & Partial<ColumnSummary>

export const safeExtractColumn = <T extends ColumnLike>(column: T, columnSummary: ColumnSummary[]): ColumnSummary => {
  let foundCols = columnSummary.filter(d => d.id === column.id)
  if (!foundCols.length) {
    let error = column.id === undefined
      ? new Error('please add an "id" property to all the <Column ... />')
      : new Error(`column with id: "${column.id}" not found`)
    if (strictBuild) throw error
    console.warn(error.message)
    return {id: column.id ?? ''}
  }
  return foundCols[0]
}

export const weightedMean = (data: Record<string, unknown>[], valueCol: string, weightCol?: string | null): number | null => {
  if (!weightCol) return null
  if (!data.length) return null

  let totalWeightedValue = 0
  let totalWeight = 0

  for (let item of data) {
    let value = Number(item[valueCol] ?? 0)
    let weight = Number(item[weightCol] ?? 0)
    totalWeightedValue += value * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedValue / totalWeight : 0
}

export const median = (data: Record<string, unknown>[], column: string): number => {
  let values = data
    .map(item => item[column])
    .filter(val => val !== undefined && val !== null && !Number.isNaN(Number(val)))
    .map(val => Number(val))
    .sort((a, b) => a - b)

  if (!values.length) return 0

  let mid = Math.floor(values.length / 2)
  return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2
}

export const aggregateColumn = (
  data: Record<string, unknown>[],
  columnName: string,
  aggType: string | undefined,
  columnType?: string,
  weightColumnName?: string | null,
): number | string | null => {
  if (!data || !data.length) return null

  if (!aggType && columnType === 'number') aggType = 'sum'

  if (
    columnType !== 'number' &&
    ['sum', 'min', 'max', 'mean', 'weightedMean', 'median', undefined].includes(aggType as any)
  ) {
    return '-'
  }

  let columnValues = data
    .map(row => row[columnName])
    .filter(val => val !== undefined && val !== null)
    .map(val => Number(val))

  switch (aggType) {
    case 'sum':
      return columnValues.reduce((sum, val) => sum + Number(val), 0)
    case 'min':
      return Math.min(...columnValues)
    case 'max':
      return Math.max(...columnValues)
    case 'mean':
      return columnValues.length
        ? columnValues.reduce((sum, val) => sum + Number(val), 0) / columnValues.length
        : '-'
    case 'count':
      return data.length
    case 'countDistinct':
      return new Set(columnValues).size
    case 'weightedMean':
      if (!weightColumnName) return 'Weight column name required for weightedMean'
      let totalWeight = 0
      let weightedSum = 0
      for (let row of data) {
        let weight = Number(row[weightColumnName] ?? 0)
        totalWeight += weight
        weightedSum += Number(row[columnName] ?? 0) * weight
      }
      return totalWeight > 0 ? weightedSum / totalWeight : null
    case 'median':
      return median(data, columnName)
    case undefined:
      return '-'
    default:
      return aggType ?? '-'
  }
}

export const getFinalColumnOrder = (columns: string[], priorityColumns: Array<string | undefined>): string[] => {
  let priorities = priorityColumns.filter(Boolean) as string[]
  let restColumns = columns.filter(key => !priorities.includes(key))
  return [...priorities, ...restColumns]
}
