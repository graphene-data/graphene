import type {
  DatasetComponentOption,
  EChartsOption,
  GridComponentOption,
  LegendComponentOption,
  SeriesOption,
  TitleComponentOption,
  TooltipComponentOption,
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

// ECharts supports a lightweight split hint so configs stay concise.
// - `encode.splitBy: "field"` splits one template into one series per distinct field value.
// - `encode.splitBy: ["groupBy", "stackBy"]` is bar-only grouped+stacked shorthand.
// - with a single split field, use native `series.stack` to choose stacked vs grouped behavior.
export type SeriesWithGroupingHint = Omit<SeriesOption, 'encode'> &
  CommonSeriesFields & {
    stackPercentage?: boolean
    encode?: SeriesEncode & {
      splitBy?: string | string[]
      sort?: string
    }
  }

export type EChartsConfig = Omit<EChartsOption, 'series'> & {
  series?: SingleOrArray<SeriesWithGroupingHint>
  legendSelection?: any
}

type AxisWithField<TAxis> = TAxis & {field?: Field}

// Config shape after enrich() normalization runs.
// We keep this mutable and array-based because enrichments mutate in place.
export type NormalConfig = Omit<EChartsConfig, 'series' | 'xAxis' | 'yAxis' | 'dataset' | 'grid' | 'legend' | 'title' | 'tooltip'> & {
  series: SeriesWithGroupingHint[]
  xAxis: AxisWithField<XAXisComponentOption>[]
  yAxis: AxisWithField<YAXisComponentOption>[]
  dataset: DatasetComponentOption[]
  grid: GridComponentOption[]
  legend: LegendComponentOption[]
  title: TitleComponentOption[]
  tooltip: TooltipComponentOption[]
}
