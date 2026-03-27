import type {EChartsOption} from 'echarts6/types/dist/echarts'

type SingleOrArray<T> = T | T[]
type OptionItem<T> = T extends Array<infer U> ? U : T

type EChartsSeries = OptionItem<NonNullable<EChartsOption['series']>>

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

// ECharts2 supports `series: 'fieldName'` as a shorthand grouping hint.
export type SeriesWithGroupingHint = EChartsSeries & {
  series?: string
}

export type EChartsConfig2 = Omit<EChartsOption, 'series'> & {
  series?: SingleOrArray<SeriesWithGroupingHint>
}
