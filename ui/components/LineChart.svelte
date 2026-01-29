<script lang="ts">
  import type {Snippet} from 'svelte'
  import Chart from './Chart.svelte'
  import Line from './Line.svelte'
  import QueryLoad from './QueryLoad.svelte'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data?: any, x?: any, y?: any, y2?: any, series?: any, xType?: any, yLog?: any, yLogBase?: any
    y2SeriesType?: any, yFmt?: any, xFmt?: any, y2Fmt?: any, title?: any, subtitle?: any, legend?: any
    xAxisTitle?: any, yAxisTitle?: any, y2AxisTitle?: any, xGridlines?: any, yGridlines?: any
    y2Gridlines?: any, xAxisLabels?: any, yAxisLabels?: any, y2AxisLabels?: any, xBaseline?: any
    yBaseline?: any, y2Baseline?: any, xTickMarks?: any, yTickMarks?: any, y2TickMarks?: any
    yMin?: any, yMax?: any, yScale?: any, y2Min?: any, y2Max?: any, y2Scale?: any, sort?: any
    lineColor?: any, lineType?: any, lineWidth?: any, lineOpacity?: any, chartAreaHeight?: any
    markers?: any, markerShape?: any, markerSize?: any, handleMissing?: any, step?: any
    stepPosition?: any, colorPalette?: string, labels?: any, labelSize?: any, labelPosition?: any
    labelColor?: any, labelFmt?: any, yLabelFmt?: any, y2LabelFmt?: any, showAllLabels?: any
    yAxisColor?: any, y2AxisColor?: any, echartsOptions?: any, seriesOptions?: any, seriesColors?: any
    seriesOrder?: any, connectGroup?: any, seriesLabelFmt?: any, leftPadding?: any, rightPadding?: any
    xLabelWrap?: any, children?: Snippet
  }

  const {resolveColor, resolveColorsObject, resolveColorPalette} = getThemeStores()

  let {
    data = undefined, x = undefined, y = undefined, y2 = undefined, series = undefined, xType = undefined,
    yLog = undefined, yLogBase = undefined, y2SeriesType = undefined, yFmt = undefined, xFmt = undefined,
    y2Fmt = undefined, title = undefined, subtitle = undefined, legend = undefined, xAxisTitle = undefined,
    yAxisTitle = undefined, y2AxisTitle = undefined, xGridlines = undefined, yGridlines = undefined,
    y2Gridlines = undefined, xAxisLabels = undefined, yAxisLabels = undefined, y2AxisLabels = undefined,
    xBaseline = undefined, yBaseline = undefined, y2Baseline = undefined, xTickMarks = undefined,
    yTickMarks = undefined, y2TickMarks = undefined, yMin = undefined, yMax = undefined, yScale = undefined,
    y2Min = undefined, y2Max = undefined, y2Scale = undefined, sort = undefined, lineColor = undefined,
    lineType = undefined, lineWidth = undefined, lineOpacity = undefined, chartAreaHeight = undefined,
    markers = undefined, markerShape = undefined, markerSize = undefined, handleMissing = undefined,
    step = undefined, stepPosition = undefined, colorPalette = 'default', labels = undefined,
    labelSize = undefined, labelPosition = undefined, labelColor = undefined, labelFmt = undefined,
    yLabelFmt = undefined, y2LabelFmt = undefined, showAllLabels = undefined, yAxisColor = undefined,
    y2AxisColor = undefined, echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined,
    seriesOrder = undefined, connectGroup = undefined, seriesLabelFmt = undefined, leftPadding = undefined,
    rightPadding = undefined, xLabelWrap = undefined, children,
  }: Props = $props()

  let lineColorStore = $derived(resolveColor(lineColor))
  let colorPaletteStore = $derived(resolveColorPalette(colorPalette))
  let labelColorStore = $derived(resolveColor(labelColor))
  let yAxisColorStore = $derived(resolveColor(yAxisColor))
  let y2AxisColorStore = $derived(resolveColor(y2AxisColor))
  let seriesColorsStore = $derived(resolveColorsObject(seriesColors))

  let derivedYAxisTitle = $derived(yAxisTitle ?? (y2 ? 'true' : undefined))
  let derivedY2AxisTitle = $derived(y2AxisTitle ?? (y2 ? 'true' : undefined))
</script>

{#snippet lineChartContent(loaded: any[])}
  <Chart
    data={loaded}
    chartContext={{data, x, y, series}}
    {x}
    {y}
    {y2}
    {xFmt}
    {yFmt}
    {y2Fmt}
    {series}
    {xType}
    {yLog}
    {yLogBase}
    {legend}
    {xAxisTitle}
    yAxisTitle={derivedYAxisTitle}
    y2AxisTitle={derivedY2AxisTitle}
    {xGridlines}
    {yGridlines}
    {y2Gridlines}
    {xAxisLabels}
    {yAxisLabels}
    {y2AxisLabels}
    {xBaseline}
    {yBaseline}
    {y2Baseline}
    {xTickMarks}
    {yTickMarks}
    {y2TickMarks}
    yAxisColor={yAxisColorStore}
    y2AxisColor={y2AxisColorStore}
    {yMin}
    {yMax}
    {yScale}
    {y2Min}
    {y2Max}
    {y2Scale}
    {title}
    {subtitle}
    chartType="Line Chart"
    {sort}
    {chartAreaHeight}
    colorPalette={colorPaletteStore}
    {echartsOptions}
    {seriesOptions}
    {connectGroup}
    seriesColors={seriesColorsStore}
    {leftPadding}
    {rightPadding}
    {xLabelWrap}
  >
    <Line
      lineColor={lineColorStore}
      {lineWidth}
      {lineOpacity}
      {lineType}
      {markers}
      {markerShape}
      {markerSize}
      {handleMissing}
      {step}
      {stepPosition}
      {labels}
      {labelSize}
      {labelPosition}
      labelColor={labelColorStore}
      {labelFmt}
      {yLabelFmt}
      {y2LabelFmt}
      {showAllLabels}
      {y2SeriesType}
      {seriesOrder}
      {seriesLabelFmt}
    />
    {@render children?.()}
  </Chart>
{/snippet}

<QueryLoad data={data} fields={{x, y: parseCommaList(y), y2: parseCommaList(y2), series}} children={lineChartContent} />
