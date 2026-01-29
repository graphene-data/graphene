<script lang="ts" module>
  export const evidenceInclude = true
</script>

<script lang="ts">
  import {getContext, onDestroy, onMount, untrack} from 'svelte'
  import {type Writable, get} from 'svelte/store'
  import {propKey, strictBuild} from '../component-utilities/chartContext.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/convert'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    id: string, description?: string, contentType?: string, title?: string, align?: string
    wrap?: boolean | string, wrapTitle?: boolean | string, height?: string, width?: string, alt?: string
    openInNewTab?: boolean | string, linkLabel?: string, fmt?: string, totalAgg?: string, totalFmt?: string
    weightCol?: string, subtotalFmt?: string, colorMax?: string, colorMin?: string, colorMid?: string
    colorBreakpoints?: string[], colorScale?: any, scaleColumn?: string, downIsGood?: boolean | string
    showValue?: boolean | string, deltaSymbol?: boolean | string, neutralMin?: number | string
    neutralMax?: number | string, chip?: boolean | string, sparkWidth?: number | string
    sparkHeight?: number | string, sparkColor?: string, sparkX?: string, sparkY?: string
    sparkYScale?: boolean | string, barColor?: string, negativeBarColor?: string, backgroundColor?: string
    hideLabels?: boolean | string, colGroup?: string, fmtColumn?: string, redNegatives?: boolean | string
  }

  let {
    id, description = undefined, contentType = undefined, title = undefined, align = undefined,
    wrap = undefined, wrapTitle = undefined, height = undefined, width = undefined, alt = undefined,
    openInNewTab = undefined, linkLabel = undefined, fmt = undefined, totalAgg = undefined,
    totalFmt = undefined, weightCol = undefined, subtotalFmt = undefined, colorMax = undefined,
    colorMin = undefined, colorMid = undefined, colorBreakpoints = undefined, colorScale = 'default',
    scaleColumn = undefined, downIsGood = undefined, showValue = undefined, deltaSymbol = undefined,
    neutralMin = 0, neutralMax = 0, chip = undefined, sparkWidth = undefined, sparkHeight = undefined,
    sparkColor = undefined, sparkX = undefined, sparkY = undefined, sparkYScale = undefined,
    barColor = '#a5cdee', negativeBarColor = '#fca5a5', backgroundColor = 'transparent',
    hideLabels = undefined, colGroup = undefined, fmtColumn = undefined, redNegatives = undefined,
  }: Props = $props()

  const {resolveColor, resolveColorPalette} = getThemeStores()

  // Get stores reactively - use $derived to track prop changes
  let barColorStore = $derived(resolveColor(barColor))
  let negativeBarColorStore = $derived(resolveColor(negativeBarColor))
  let backgroundColorStore = $derived(resolveColor(backgroundColor))
  let colorScaleStore = $derived(resolveColorPalette(colorScale))

  const chartProps = getContext<Writable<any>>(propKey)

  const identifier = Symbol('GrapheneColumn')

  const coerceNumber = (value: number | string | undefined): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    let parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  // Build the column options object - as a function so it can be called synchronously
  const getColumnOptions = () => ({
    identifier,
    id,
    title,
    align,
    wrap: toBoolean(wrap) ?? false,
    wrapTitle: toBoolean(wrapTitle) ?? false,
    contentType,
    height,
    width,
    alt,
    openInNewTab: toBoolean(openInNewTab) ?? false,
    linkLabel,
    fmt,
    fmtColumn,
    totalAgg,
    totalFmt,
    subtotalFmt,
    weightCol,
    downIsGood: toBoolean(downIsGood) ?? false,
    deltaSymbol: toBoolean(deltaSymbol) ?? true,
    chip: toBoolean(chip) ?? false,
    neutralMin: coerceNumber(neutralMin) ?? 0,
    neutralMax: coerceNumber(neutralMax) ?? 0,
    showValue: toBoolean(showValue) ?? true,
    colorMax,
    colorMin,
    colorMid,
    colorScale: get(colorScaleStore),
    colorBreakpoints: parseCommaList(colorBreakpoints),
    scaleColumn,
    colGroup,
    description,
    redNegatives: toBoolean(redNegatives) ?? false,
    sparkWidth,
    sparkHeight,
    sparkColor,
    sparkX,
    sparkY,
    sparkYScale: toBoolean(sparkYScale) ?? false,
    barColor: get(barColorStore),
    negativeBarColor: get(negativeBarColorStore),
    backgroundColor: get(backgroundColorStore),
    hideLabels: toBoolean(hideLabels) ?? false,
  })

  // Register column on mount
  onMount(() => {
    // Check column name once on mount (not reactively)
    try {
      let data = get(chartProps).data?.[0]
      if (data && !Object.keys(data).includes(id)) {
        let error = `Error in table: ${id} does not exist in the dataset`
        if (strictBuild) throw new Error(error)
        console.warn(error)
      }
    } catch (error) {
      if (strictBuild) throw error
    }

    // Initial registration
    chartProps.update((state: any) => {
      let next = {...state, columns: [...state.columns, getColumnOptions()]}
      return next
    })
  })

  // Update column options when props change
  // Track all the props that affect columnOptions
  $effect(() => {
    // Read all props that could change
    void [id, title, align, wrap, wrapTitle, contentType, height, width, alt, openInNewTab,
      linkLabel, fmt, fmtColumn, totalAgg, totalFmt, subtotalFmt, weightCol, downIsGood,
      deltaSymbol, chip, neutralMin, neutralMax, showValue, colorMax, colorMin, colorMid,
      colorScale, colorBreakpoints, scaleColumn, colGroup, description, redNegatives,
      sparkWidth, sparkHeight, sparkColor, sparkX, sparkY, sparkYScale, barColor,
      negativeBarColor, backgroundColor, hideLabels]
    // Also track store values
    void [$colorScaleStore, $barColorStore, $negativeBarColorStore, $backgroundColorStore]

    // Use untrack to prevent this update from creating a dependency loop
    untrack(() => {
      chartProps.update((state: any) => {
        let next = {...state}
        let existing = next.columns.findIndex((column: any) => column.identifier === identifier)
        let option = getColumnOptions()
        if (existing !== -1) {
          next.columns = [
            ...next.columns.slice(0, existing),
            option,
            ...next.columns.slice(existing + 1),
          ]
        }
        return next
      })
    })
  })

  onDestroy(() => {
    untrack(() => {
      chartProps.update((state: any) => {
        return {...state, columns: state.columns.filter((column: any) => column.identifier !== identifier)}
      })
    })
  })
</script>
