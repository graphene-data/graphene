<script lang="ts">
  import {formatValue, getFormatObjectFromString} from '@evidence-dev/component-utilities/formatting'
  import {getThemeStores} from './themeStores'
  import {toBoolean} from './utils'

  export let value: number | string | null | undefined = undefined
  export let fmt: string | undefined = undefined
  export let formatObject: any = undefined
  export let columnUnitSummary: any = undefined
  export let downIsGood = false
  export let showValue = true
  export let showSymbol = true
  export let symbolPosition: 'left' | 'right' = 'right'
  export let neutralMin = 0
  export let neutralMax = 0
  export let chip = false
  export let align: 'left' | 'right' | 'center' | string = 'right'
  export let text: string | undefined = undefined
  export let className: string | undefined = undefined

  downIsGood = toBoolean(downIsGood) ?? false
  showValue = toBoolean(showValue) ?? true
  showSymbol = toBoolean(showSymbol) ?? true
  chip = toBoolean(chip) ?? false

  const {theme} = getThemeStores()

  $: numericValue = value === null || value === undefined ? null : Number(value)
  $: status = numericValue === null
    ? 'neutral'
    : numericValue > neutralMax
      ? 'positive'
      : numericValue < neutralMin
        ? 'negative'
        : 'neutral'

  const pickColor = (positive: string, negative: string, neutral: string) => {
    if (status === 'positive') return positive
    if (status === 'negative') return negative
    return neutral
  }

  $: symbol = status === 'positive' ? '▲' : status === 'negative' ? '▼' : '–'
  $: symbolColor = pickColor(
    downIsGood ? $theme.colors.negative : $theme.colors.positive,
    downIsGood ? $theme.colors.positive : $theme.colors.negative,
    $theme.colors['base-content-muted'],
  )

  $: textColor = pickColor(
    downIsGood ? $theme.colors.negative : $theme.colors.positive,
    downIsGood ? $theme.colors.positive : $theme.colors.negative,
    $theme.colors['base-content-muted'],
  )

  $: chipClass = pickColor('delta-chip--positive', 'delta-chip--negative', 'delta-chip--neutral')

  $: resolvedFormat = formatObject
    ? formatObject
    : fmt
      ? getFormatObjectFromString(fmt, 'number')
      : undefined

  const renderValue = () => {
    if (numericValue === null) return '–'
    try {
      return formatValue(numericValue, resolvedFormat, columnUnitSummary)
    } catch (error) {
      console.error('Failed to format delta value', error)
      return String(numericValue)
    }
  }
</script>

<span class={`delta ${chip ? `delta-chip ${chipClass}` : ''} ${className ?? ''}`.trim()} style={`text-align:${align ?? 'right'}`}>
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
