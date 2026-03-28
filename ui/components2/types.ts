import type {EChartsOption} from 'echarts6/types/dist/echarts'

type SingleOrArray<T> = T | T[]
type OptionItem<T> = T extends Array<infer U> ? U : T

type EChartsSeries = OptionItem<NonNullable<EChartsOption['series']>>
type EChartsEncode = Record<string, any>

export type Field = {
  name: string
  type?: string
  evidenceType?: string
  metadata?: {
    pct?: true
    units?: string
    granularity?: string
  }
}

// ECharts2 supports lightweight grouping hints so configs stay concise.
// - `encode.group` or `encode.stack` splits one template into one series per distinct value.
// - these hints are mutually exclusive.
export type SeriesWithGroupingHint = Omit<EChartsSeries, 'encode'> & {
  stackPercentage?: boolean
  encode?: EChartsEncode & {
    group?: string
    stack?: string
  }
}

export type EChartsConfig2 = Omit<EChartsOption, 'series'> & {
  series?: SingleOrArray<SeriesWithGroupingHint>
}
