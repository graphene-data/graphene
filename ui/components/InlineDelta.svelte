<script lang="ts">
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    value?: number | string | null
    fmt?: string
    formatObject?: any
    columnUnitSummary?: any
    downIsGood?: boolean
    showValue?: boolean
    showSymbol?: boolean
    symbolPosition?: 'left' | 'right'
    neutralMin?: number
    neutralMax?: number
    chip?: boolean
    align?: 'left' | 'right' | 'center' | string
    text?: string
    className?: string
  }

  let {
    value = undefined,
    fmt = undefined,
    formatObject = undefined,
    columnUnitSummary = undefined,
    downIsGood: downIsGoodProp = false,
    showValue: showValueProp = true,
    showSymbol: showSymbolProp = true,
    symbolPosition = 'right',
    neutralMin = 0,
    neutralMax = 0,
    chip: chipProp = false,
    align = 'right',
    text = undefined,
    className = undefined,
  }: Props = $props()

  let downIsGood = $derived(toBoolean(downIsGoodProp) ?? false)
  let showValue = $derived(toBoolean(showValueProp) ?? true)
  let showSymbol = $derived(toBoolean(showSymbolProp) ?? true)
  let chip = $derived(toBoolean(chipProp) ?? false)

  const {theme} = getThemeStores()

  let numericValue = $derived(value === null || value === undefined ? null : Number(value))
  let status = $derived((() => {
    if (numericValue === null) return 'neutral'
    if (numericValue > neutralMax) return 'positive'
    if (numericValue < neutralMin) return 'negative'
    return 'neutral'
  })())

  const pickColor = (positive: string, negative: string, neutral: string) => {
    if (status === 'positive') return positive
    if (status === 'negative') return negative
    return neutral
  }

  let symbol = $derived((() => {
    if (status === 'positive') return '▲'
    if (status === 'negative') return '▼'
    return '–'
  })())
  let symbolColor = $derived(pickColor(
    downIsGood ? $theme.colors.negative : $theme.colors.positive,
    downIsGood ? $theme.colors.positive : $theme.colors.negative,
    $theme.colors['base-content-muted'],
  ))

  let textColor = $derived(pickColor(
    downIsGood ? $theme.colors.negative : $theme.colors.positive,
    downIsGood ? $theme.colors.positive : $theme.colors.negative,
    $theme.colors['base-content-muted'],
  ))

  let chipClass = $derived(pickColor('delta-chip--positive', 'delta-chip--negative', 'delta-chip--neutral'))

  let resolvedFormat = $derived((() => {
    if (formatObject) return formatObject
    if (fmt) return getFormatObjectFromString(fmt, 'number')
    return undefined
  })())

  let deltaClass = $derived((() => {
    let classes = ['delta']
    if (chip) classes = [...classes, 'delta-chip', chipClass]
    if (className) classes.push(className)
    return classes.join(' ')
  })())

  let resolvedAlign = $derived(align ?? 'right')

  const renderValue = () => {
    if (numericValue === null) return '–'
    try {
      return formatValue(numericValue, resolvedFormat, columnUnitSummary)
    } catch(error) {
      console.error('Failed to format delta value', error)
      return String(numericValue)
    }
  }
</script>

<span class={deltaClass} style={`text-align:${resolvedAlign}`}>
  {#if symbolPosition === 'left'}
    {#if showSymbol}
      <span class="delta-symbol" style={`color:${symbolColor}`}>{symbol}</span>
    {/if}
  {/if}
  {#if showValue}
    <span class="delta-value" style={`color:${textColor}`}>{renderValue()}</span>
  {/if}
  {#if symbolPosition === 'right'}
    {#if showSymbol}
      <span class="delta-symbol" style={`color:${symbolColor}`}>{symbol}</span>
    {/if}
  {/if}
  {#if text}
    <span class="delta-text">{text}</span>
  {/if}
</span>

<style>
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }

  .delta-value {
    font-family: inherit;
  }

  .delta-symbol {
    font-size: 0.75em;
    line-height: 1;
  }

  .delta-text {
    margin-left: 2px;
    color: var(--color-base-content-muted, #6b7280);
    font-size: 0.85em;
  }

  .delta-chip {
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 1px 4px;
    font-size: 0.9em;
  }

  .delta-chip--positive {
    background: rgba(22, 163, 74, 0.1);
    border-color: rgba(22, 163, 74, 0.2);
  }

  .delta-chip--negative {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.2);
  }

  .delta-chip--neutral {
    background: rgba(107, 114, 128, 0.1);
    border-color: rgba(107, 114, 128, 0.2);
  }
</style>
