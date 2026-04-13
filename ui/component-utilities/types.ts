import type {
  DatasetComponentOption,
  EChartsOption,
  GridComponentOption,
  LegendComponentOption,
  SeriesOption,
  TitleComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts/types/dist/echarts'

import type {Field as ApiField, QueryResult as ApiQueryResult} from '../../lang/index.d.ts'

type SingleOrArray<T> = T | T[]
type SeriesEncode = Record<string, unknown>

export type Field = ApiField
export type QueryResult = ApiQueryResult

type CommonSeriesFields = {
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
  showSymbol?: boolean
}

// ECharts supports lightweight grouping hints so configs stay concise.
// - `encode.group` or `encode.stack` splits one template into one series per distinct value.
// - these hints are mutually exclusive.
export type SeriesWithGroupingHint = Omit<SeriesOption, 'encode'> &
  CommonSeriesFields & {
    stackPercentage?: boolean
    encode?: SeriesEncode & {
      group?: string
      stack?: string
    }
  }

export type EChartsConfig = Omit<EChartsOption, 'series'> & {
  series?: SingleOrArray<SeriesWithGroupingHint>
  legendSelection?: any
}

type AxisWithField<TAxis> = TAxis & {field?: Field}

// Config shape after enrich() normalization runs.
// We keep this mutable and array-based because enrichments mutate in place.
export type NormalConfig = Omit<EChartsConfig, 'series' | 'xAxis' | 'yAxis' | 'dataset' | 'grid' | 'legend' | 'title'> & {
  series: SeriesWithGroupingHint[]
  xAxis: AxisWithField<XAXisComponentOption>[]
  yAxis: AxisWithField<YAXisComponentOption>[]
  dataset: DatasetComponentOption[]
  grid: GridComponentOption[]
  legend: LegendComponentOption[]
  title: TitleComponentOption[]
}
