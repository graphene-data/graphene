import type {FieldMetadata, GrapheneError} from '../../lang/types.ts'

type SingleOrArray<T> = T | T[]

type EChartsSeries = Record<string, any>
type EChartsXAxis = Record<string, any>
type EChartsYAxis = Record<string, any>
type EChartsDataset = Record<string, any>
type EChartsGrid = Record<string, any>
type EChartsLegend = Record<string, any>
type EChartsTitle = Record<string, any>
type EChartsEncode = Record<string, any>

export interface QueryResult {
  rows: any[]
  fields?: Field[]
  error?: GrapheneError
}

export type Field = {
  name: string
  type?: string
  evidenceType?: string
  metadata?: FieldMetadata
}

// ECharts supports lightweight grouping hints so configs stay concise.
// - `encode.group` or `encode.stack` splits one template into one series per distinct value.
// - these hints are mutually exclusive.
export type SeriesWithGroupingHint = Omit<EChartsSeries, 'encode'> & {
  type?: string
  name?: string
  color?: string
  stack?: string
  datasetId?: string
  data?: unknown
  xAxisIndex?: number
  yAxisIndex?: number
  label?: Record<string, any>
  labelLayout?: Record<string, any> | ((...args: any[]) => any)
  itemStyle?: Record<string, any>
  lineStyle?: Record<string, any>
  areaStyle?: Record<string, any>
  stackPercentage?: boolean
  encode?: EChartsEncode & {
    group?: string
    stack?: string
  }
}

export type EChartsConfig2 = {
  series?: SingleOrArray<SeriesWithGroupingHint>
  xAxis?: SingleOrArray<EChartsXAxis>
  yAxis?: SingleOrArray<EChartsYAxis>
  dataset?: SingleOrArray<EChartsDataset>
  grid?: SingleOrArray<EChartsGrid>
  legend?: SingleOrArray<EChartsLegend>
  title?: SingleOrArray<EChartsTitle>
  color?: string[]
  [key: string]: any
}

// Config shape after enrich() normalization runs.
// We keep this mutable and array-based because enrichments mutate in place.
export type NormalConfig = Omit<EChartsConfig2, 'series' | 'xAxis' | 'yAxis' | 'dataset' | 'grid' | 'legend' | 'title'> & {
  series: SeriesWithGroupingHint[]
  xAxis: EChartsXAxis[]
  yAxis: EChartsYAxis[]
  dataset: EChartsDataset[]
  grid: EChartsGrid[]
  legend: EChartsLegend[]
  title: EChartsTitle[]
}
