<script lang="ts">
  import type {Snippet} from 'svelte'
  import Chart from './Chart.svelte'
  import Bar from './Bar.svelte'
  import QueryLoad from './QueryLoad.svelte'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data?: any, x?: any, y?: any, y2?: any, series?: any, xType?: any, yLog?: any, yLogBase?: any
    y2SeriesType?: any, yFmt?: any, y2Fmt?: any, xFmt?: any, title?: any, subtitle?: any, legend?: any
    xAxisTitle?: any, yAxisTitle?: any, y2AxisTitle?: any, xGridlines?: any, yGridlines?: any
    y2Gridlines?: any, xAxisLabels?: any, yAxisLabels?: any, y2AxisLabels?: any, xBaseline?: any
    yBaseline?: any, y2Baseline?: any, xTickMarks?: any, yTickMarks?: any, y2TickMarks?: any
    yMin?: any, yMax?: any, yScale?: any, y2Min?: any, y2Max?: any, y2Scale?: any
    swapXY?: boolean | string, showAllXAxisLabels?: boolean, type?: string, fillColor?: any
    fillOpacity?: any, outlineColor?: any, outlineWidth?: any, chartAreaHeight?: any, sort?: any
    colorPalette?: string, labels?: any, labelSize?: any, labelPosition?: any, labelColor?: any
    labelFmt?: any, yLabelFmt?: any, y2LabelFmt?: any, stackTotalLabel?: any, seriesLabels?: any
    showAllLabels?: any, yAxisColor?: any, y2AxisColor?: any, echartsOptions?: any, seriesOptions?: any
    seriesColors?: any, seriesOrder?: any, connectGroup?: any, seriesLabelFmt?: any, leftPadding?: any
    rightPadding?: any, xLabelWrap?: any, children?: Snippet
  }

  const {resolveColor, resolveColorsObject, resolveColorPalette} = getThemeStores()

  let {
    data = undefined, x = undefined, y = undefined, y2 = undefined, series = undefined, xType = undefined,
    yLog = undefined, yLogBase = undefined, y2SeriesType = undefined, yFmt = undefined, y2Fmt = undefined,
    xFmt = undefined, title = undefined, subtitle = undefined, legend = undefined, xAxisTitle = undefined,
    yAxisTitle = undefined, y2AxisTitle = undefined, xGridlines = undefined, yGridlines = undefined,
    y2Gridlines = undefined, xAxisLabels = undefined, yAxisLabels = undefined, y2AxisLabels = undefined,
    xBaseline = undefined, yBaseline = undefined, y2Baseline = undefined, xTickMarks = undefined,
    yTickMarks = undefined, y2TickMarks = undefined, yMin = undefined, yMax = undefined, yScale = undefined,
    y2Min = undefined, y2Max = undefined, y2Scale = undefined, swapXY = false, showAllXAxisLabels = undefined,
    type = 'stacked', fillColor = undefined, fillOpacity = undefined, outlineColor = undefined,
    outlineWidth = undefined, chartAreaHeight = undefined, sort = undefined, colorPalette = 'default',
    labels = undefined, labelSize = undefined, labelPosition = undefined, labelColor = undefined,
    labelFmt = undefined, yLabelFmt = undefined, y2LabelFmt = undefined, stackTotalLabel = undefined,
    seriesLabels = undefined, showAllLabels = undefined, yAxisColor = undefined, y2AxisColor = undefined,
    echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined, seriesOrder = undefined,
    connectGroup = undefined, seriesLabelFmt = undefined, leftPadding = undefined, rightPadding = undefined,
    xLabelWrap = undefined, children,
  }: Props = $props()

  let normalizedSwapXY = $derived(swapXY === 'true' || swapXY === true)

  let stacked100 = $derived(type === 'stacked100')

  let fillColorStore = $derived(resolveColor(fillColor))
  let outlineColorStore = $derived(resolveColor(outlineColor))
  let colorPaletteStore = $derived(resolveColorPalette(colorPalette))
  let labelColorStore = $derived(resolveColor(labelColor))
  let yAxisColorStore = $derived(resolveColor(yAxisColor))
  let y2AxisColorStore = $derived(resolveColor(y2AxisColor))
  let seriesColorsStore = $derived(resolveColorsObject(seriesColors))

  let derivedYAxisTitle = $derived(yAxisTitle ?? (y2 ? 'true' : undefined))
  let derivedY2AxisTitle = $derived(y2AxisTitle ?? (y2 ? 'true' : undefined))
</script>

{#snippet barChartContent(loaded: any[])}
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
    swapXY={normalizedSwapXY}
    {title}
    {subtitle}
    chartType="Bar Chart"
    stackType={type}
    {sort}
    {stacked100}
    {chartAreaHeight}
    {showAllXAxisLabels}
    colorPalette={colorPaletteStore}
    {echartsOptions}
    {seriesOptions}
    {connectGroup}
    {xLabelWrap}
    seriesColors={seriesColorsStore}
    {leftPadding}
    {rightPadding}
  >
    <Bar
      {type}
      fillColor={fillColorStore}
      {fillOpacity}
      outlineColor={outlineColorStore}
      {outlineWidth}
      {labels}
      {labelSize}
      {labelPosition}
      labelColor={labelColorStore}
      {labelFmt}
      {yLabelFmt}
      {y2LabelFmt}
      {stackTotalLabel}
      {seriesLabels}
      {showAllLabels}
      {y2SeriesType}
      {seriesOrder}
      {seriesLabelFmt}
    />
    {@render children?.()}
  </Chart>
{/snippet}

<QueryLoad data={data} fields={{x, y: parseCommaList(y), y2: parseCommaList(y2), series}} children={barChartContent} />
