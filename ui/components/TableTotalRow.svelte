<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import TableCell from './TableCell.svelte'
  import {safeExtractColumn, weightedMean} from './tableUtils'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'

  export let data: any[] = []
  export let rowNumbers: boolean | string | undefined = undefined
  export let columnSummary: any[] = []
  export let rowColor: string | undefined = undefined
  export let fontColor: string | undefined = undefined
  export let groupType: 'accordion' | 'section' | undefined = undefined
  export let orderedColumns: any[] = []
  export let compact: boolean | string | undefined = undefined

  const toBool = (value: boolean | string | undefined) => {
    if (value === undefined) return false
    if (typeof value === 'string') {
      let normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return Boolean(value)
  }

  rowNumbers = toBool(rowNumbers)
  compact = toBool(compact)
</script>

<tr class="total-row" style:background-color={rowColor} style:color={fontColor}>
  {#if rowNumbers && groupType !== 'section'}
    <TableCell class="index" {compact} topBorder="1px solid rgba(107, 114, 128, 0.5)" />
  {/if}

  {#each orderedColumns as column (column.id)}
    {@const summary = safeExtractColumn(column, columnSummary)}
    {@const format = (() => {
      if (column.totalFmt) return getFormatObjectFromString(column.totalFmt)
      if (column.fmt) return getFormatObjectFromString(column.fmt, summary.format?.valueType)
      return summary.format
    })()}
    {@const totalAgg = column.totalAgg ?? 'sum'}
    <TableCell
      {compact}
      dataType={summary.type}
      align={column.align}
      height={column.height}
      width={column.width}
      wrap={column.wrap}
      topBorder="1px solid rgba(107, 114, 128, 0.5)"
    >
      {#if ['sum', 'mean', 'weightedMean', 'median', 'min', 'max', 'count', 'countDistinct'].includes(totalAgg)}
        {#if column.contentType === 'delta'}
          <InlineDelta
            value={totalAgg === 'weightedMean' ? weightedMean(data, column.id, column.weightCol) : summary.columnUnitSummary?.[totalAgg]}
            downIsGood={column.downIsGood}
            formatObject={format}
            columnUnitSummary={summary.columnUnitSummary}
            showValue={column.showValue}
            showSymbol={column.deltaSymbol}
            align={column.align}
            neutralMin={column.neutralMin ?? 0}
            neutralMax={column.neutralMax ?? 0}
            chip={column.chip}
          />
        {:else}
          {formatValue(
            totalAgg === 'weightedMean' ? weightedMean(data, column.id, column.weightCol) : summary.columnUnitSummary?.[totalAgg],
            format,
            summary.columnUnitSummary,
          )}
        {/if}
      {:else}
        {#if column.totalFmt}
          {formatValue(totalAgg, format, summary.columnUnitSummary)}
        {:else}
          {totalAgg}
        {/if}
      {/if}
    </TableCell>
  {/each}
</tr>

<style>
  .total-row {
    font-weight: 600;
  }
</style>
