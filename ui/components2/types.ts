import type {EChartsOption} from 'echarts6/types/dist/echarts'

type SingleOrArray<T> = T | T[]
type OptionItem<T> = T extends Array<infer U> ? U : T

type EChartsXAxis = OptionItem<NonNullable<EChartsOption['xAxis']>>
export type EChartsSeries2 = OptionItem<NonNullable<EChartsOption['series']>>

type XAxisData = EChartsXAxis extends {data?: infer D} ? D : unknown[]
type SeriesData = EChartsSeries2 extends {data?: infer D} ? D : unknown[]

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

// ECharts2 accepts column references in place of concrete arrays.
export type XAxisWithColumnRef = Omit<EChartsXAxis, 'data'> & {data?: XAxisData | string}

// ECharts2 also supports `series: 'fieldName'` for grouping into multiple series.
export type SeriesWithColumnRefs = Omit<EChartsSeries2, 'data'> & {
  data?: SeriesData | string
  series?: string
}

export type EChartsConfig2 = Omit<EChartsOption, 'xAxis' | 'series'> & {
  xAxis?: SingleOrArray<XAxisWithColumnRef>
  series?: SingleOrArray<SeriesWithColumnRefs>
}
