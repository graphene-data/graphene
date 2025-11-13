<script context="module">
  export const evidenceInclude = true
</script>

<script lang="ts">
  import {getContext, onDestroy} from 'svelte'
  import {propKey, strictBuild} from '../component-utilities/chartContext.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/convert'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  export let id: string
  export let description: string | undefined = undefined
  export let contentType: string | undefined = undefined
  export let title: string | undefined = undefined
  export let align: string | undefined = undefined
  export let wrap: boolean | string | undefined = undefined
  export let wrapTitle: boolean | string | undefined = undefined
  export let height: string | undefined = undefined
  export let width: string | undefined = undefined
  export let alt: string | undefined = undefined
  export let openInNewTab: boolean | string | undefined = undefined
  export let linkLabel: string | undefined = undefined
  export let fmt: string | undefined = undefined
  export let totalAgg: string | undefined = undefined
  export let totalFmt: string | undefined = undefined
  export let weightCol: string | undefined = undefined
  export let subtotalFmt: string | undefined = undefined
  export let colorMax: string | undefined = undefined
  export let colorMin: string | undefined = undefined
  export let colorMid: string | undefined = undefined
  export let colorBreakpoints: string[] | undefined = undefined
  export let colorScale: any = 'default'
  export let scaleColumn: string | undefined = undefined
  export let downIsGood: boolean | string | undefined = undefined
  export let showValue: boolean | string | undefined = undefined
  export let deltaSymbol: boolean | string | undefined = undefined
  export let neutralMin: number | string | undefined = 0
  export let neutralMax: number | string | undefined = 0
  export let chip: boolean | string | undefined = undefined
  export let sparkWidth: number | string | undefined = undefined
  export let sparkHeight: number | string | undefined = undefined
  export let sparkColor: string | undefined = undefined
  export let sparkX: string | undefined = undefined
  export let sparkY: string | undefined = undefined
  export let sparkYScale: boolean | string | undefined = undefined
  export let barColor: string | undefined = '#a5cdee'
  export let negativeBarColor: string | undefined = '#fca5a5'
  export let backgroundColor: string | undefined = 'transparent'
  export let hideLabels: boolean | string | undefined = undefined
  export let colGroup: string | undefined = undefined
  export let fmtColumn: string | undefined = undefined
  export let redNegatives: boolean | string | undefined = undefined

  const {resolveColor, resolveColorPalette} = getThemeStores()

  let barColorStore = resolveColor(barColor)
  let negativeBarColorStore = resolveColor(negativeBarColor)
  let backgroundColorStore = resolveColor(backgroundColor)
  let colorScaleStore = resolveColorPalette(colorScale)

  $: barColorStore = resolveColor(barColor)
  $: negativeBarColorStore = resolveColor(negativeBarColor)
  $: backgroundColorStore = resolveColor(backgroundColor)
  $: colorScaleStore = resolveColorPalette(colorScale)

  const props = getContext(propKey)
  $: colorBreakpoints = parseCommaList(colorBreakpoints)

  const identifier = Symbol('GrapheneColumn')

  wrap = toBoolean(wrap) ?? false
  wrapTitle = toBoolean(wrapTitle) ?? false
  openInNewTab = toBoolean(openInNewTab) ?? false
  downIsGood = toBoolean(downIsGood) ?? false
  showValue = toBoolean(showValue) ?? true
  deltaSymbol = toBoolean(deltaSymbol) ?? true
  chip = toBoolean(chip) ?? false
  sparkYScale = toBoolean(sparkYScale) ?? false
  hideLabels = toBoolean(hideLabels) ?? false
  redNegatives = toBoolean(redNegatives) ?? false

  const coerceNumber = (value: number | string | undefined): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    let parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  const checkColumnName = () => {
    try {
      let data = $props.data?.[0]
      if (!data || !Object.keys(data).includes(id)) {
        let error = `Error in table: ${id} does not exist in the dataset`
        if (strictBuild) throw new Error(error)
        console.warn(error)
      }
    } catch (error) {
      if (strictBuild) throw error
    }
  }

  const options = () => ({
    identifier,
    id,
    title,
    align,
    wrap,
    wrapTitle,
    contentType,
    height,
    width,
    alt,
    openInNewTab,
    linkLabel,
    fmt,
    fmtColumn,
    totalAgg,
    totalFmt,
    subtotalFmt,
    weightCol,
    downIsGood,
    deltaSymbol,
    chip,
    neutralMin: coerceNumber(neutralMin) ?? 0,
    neutralMax: coerceNumber(neutralMax) ?? 0,
    showValue,
    colorMax,
    colorMin,
    colorMid,
    colorScale: $colorScaleStore,
    colorBreakpoints,
    scaleColumn,
    colGroup,
    description,
    redNegatives,
    sparkWidth,
    sparkHeight,
    sparkColor,
    sparkX,
    sparkY,
    sparkYScale,
    barColor: $barColorStore,
    negativeBarColor: $negativeBarColorStore,
    backgroundColor: $backgroundColorStore,
    hideLabels,
  })

  const updateProps = () => {
    checkColumnName()
    props.update((state: any) => {
      let next = {...state}
      let existing = next.columns.findIndex((column: any) => column.identifier === identifier)
      let option = options()
      if (existing === -1) {
        next.columns = [...next.columns, option]
      } else {
        next.columns = [
          ...next.columns.slice(0, existing),
          option,
          ...next.columns.slice(existing + 1),
        ]
      }
      return next
    })
  }

  $: updateProps()

  onDestroy(() => {
    props.update((state: any) => {
      return {...state, columns: state.columns.filter((column: any) => column.identifier !== identifier)}
    })
  })
</script>
