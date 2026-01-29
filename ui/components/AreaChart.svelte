<script lang="ts">
  import type {Snippet} from 'svelte'
  import Chart from './Chart.svelte'
  import Area from './Area.svelte'
  import QueryLoad from './QueryLoad.svelte'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data?: any, x?: any, y?: any, series?: any, xType?: any, yLog?: any, yLogBase?: any
    yFmt?: any, xFmt?: any, title?: any, subtitle?: any, legend?: any, xAxisTitle?: any, yAxisTitle?: any
    xGridlines?: any, yGridlines?: any, xAxisLabels?: any, yAxisLabels?: any, xBaseline?: any, yBaseline?: any
    xTickMarks?: any, yTickMarks?: any, yMin?: any, yMax?: any, yScale?: any, sort?: any, line?: any
    fillColor?: any, lineColor?: any, fillOpacity?: any, chartAreaHeight?: any, markers?: any
    markerShape?: any, markerSize?: any, handleMissing?: any, step?: any, stepPosition?: any, type?: string
    colorPalette?: string, labels?: any, labelSize?: any, labelPosition?: any, labelColor?: any
    labelFmt?: any, showAllLabels?: any, echartsOptions?: any, seriesOptions?: any, seriesColors?: any
    seriesOrder?: any, connectGroup?: any, seriesLabelFmt?: any, leftPadding?: any, rightPadding?: any
    xLabelWrap?: any, children?: Snippet
  }

  const {resolveColor, resolveColorsObject, resolveColorPalette} = getThemeStores()

  let {
    data = undefined, x = undefined, y = undefined, series = undefined, xType = undefined, yLog = undefined,
    yLogBase = undefined, yFmt = undefined, xFmt = undefined, title = undefined, subtitle = undefined,
    legend = undefined, xAxisTitle = undefined, yAxisTitle = undefined, xGridlines = undefined,
    yGridlines = undefined, xAxisLabels = undefined, yAxisLabels = undefined, xBaseline = undefined,
    yBaseline = undefined, xTickMarks = undefined, yTickMarks = undefined, yMin = undefined, yMax = undefined,
    yScale = undefined, sort = undefined, line = undefined, fillColor = undefined, lineColor = undefined,
    fillOpacity = undefined, chartAreaHeight = undefined, markers = undefined, markerShape = undefined,
    markerSize = undefined, handleMissing = undefined, step = undefined, stepPosition = undefined,
    type = 'stacked', colorPalette = 'default', labels = undefined, labelSize = undefined,
    labelPosition = undefined, labelColor = undefined, labelFmt = undefined, showAllLabels = undefined,
    echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined, seriesOrder = undefined,
    connectGroup = undefined, seriesLabelFmt = undefined, leftPadding = undefined, rightPadding = undefined,
    xLabelWrap = undefined, children,
  }: Props = $props()

  let stacked100 = $derived(type === 'stacked100')

  let fillColorStore = $derived(resolveColor(fillColor))
  let lineColorStore = $derived(resolveColor(lineColor))
  let colorPaletteStore = $derived(resolveColorPalette(colorPalette))
  let labelColorStore = $derived(resolveColor(labelColor))
  let seriesColorsStore = $derived(resolveColorsObject(seriesColors))
</script>

{#snippet areaChartContent(loaded: any[])}
  <Chart
    data={loaded}
    chartContext={{data, x, y, series}}
    {x}
    {y}
    {xFmt}
    {yFmt}
    {series}
    {xType}
    {yLog}
    {yLogBase}
    {legend}
    {xAxisTitle}
    {yAxisTitle}
    {xGridlines}
    {yGridlines}
    {xAxisLabels}
    {yAxisLabels}
    {xBaseline}
    {yBaseline}
    {xTickMarks}
    {yTickMarks}
    {yMin}
    {yMax}
    {yScale}
    {title}
    {subtitle}
    chartType="Area Chart"
    stackType={type}
    {stacked100}
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
    <Area
      {line}
      fillColor={fillColorStore}
      lineColor={lineColorStore}
      {fillOpacity}
      {handleMissing}
      {type}
      {step}
      {stepPosition}
      {markers}
      {markerShape}
      {markerSize}
      {labels}
      {labelSize}
      {labelPosition}
      labelColor={labelColorStore}
      {labelFmt}
      {showAllLabels}
      {seriesOrder}
      {seriesLabelFmt}
    />
    {@render children?.()}
  </Chart>
{/snippet}

<QueryLoad data={data} fields={{x, y: parseCommaList(y), series}} children={areaChartContent} />
