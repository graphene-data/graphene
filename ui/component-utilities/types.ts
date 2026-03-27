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

import type {FieldType, GrapheneError} from '../../lang/types.ts'

type SingleOrArray<T> = T | T[]
type SeriesEncode = Record<string, unknown>

export interface QueryResult {
  rows: any[]
  fields?: Field[]
  error?: GrapheneError
}

export type Field = {
  name: string
  type: FieldType
  metadata?: {
    pct?: true
    units?: string
    granularity?: string
  }
}

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

export type EChartsConfig2 = Omit<EChartsOption, 'series'> & {
  series?: SingleOrArray<SeriesWithGroupingHint>
}

// Config shape after enrich() normalization runs.
// We keep this mutable and array-based because enrichments mutate in place.
export type NormalConfig = Omit<EChartsConfig2, 'series' | 'xAxis' | 'yAxis' | 'dataset' | 'grid' | 'legend' | 'title'> & {
  series: SeriesWithGroupingHint[]
  xAxis: XAXisComponentOption[]
  yAxis: YAXisComponentOption[]
  dataset: DatasetComponentOption[]
  grid: GridComponentOption[]
  legend: LegendComponentOption[]
  title: TitleComponentOption[]
}
