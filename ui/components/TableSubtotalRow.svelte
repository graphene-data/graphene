<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import {aggregateColumn, safeExtractColumn} from '../component-utilities/tableUtils'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import TableCell from './TableCell.svelte'

  export let groupName: string | undefined = undefined
  export let currentGroupData: any[] = []
  export let columnSummary: any[] = []
  export let rowColor: string | undefined = undefined
  export let groupBy: string | undefined = undefined
  export let groupType: 'accordion' | 'section' | undefined = undefined
  export let fontColor: string | undefined = undefined
  export let orderedColumns: any[] = []
  export let compact: boolean | string | undefined = undefined
</script>

<tr class="subtotal-row" style:background-color={rowColor} style:color={fontColor}>
  {#each orderedColumns as column (column.id)}
    {@const summary = safeExtractColumn(column, columnSummary)}
    {@const baseFormat = column.fmt ? getFormatObjectFromString(column.fmt, summary.format?.valueType) : summary.format}
    {@const format = (() => {
      if (column.subtotalFmt) return getFormatObjectFromString(column.subtotalFmt)
      if (column.totalFmt) return getFormatObjectFromString(column.totalFmt)
      return baseFormat
    })()}
    <TableCell class={summary.type} {compact} align={column.align}>
      {#if column.id !== groupBy}
        {#if column.contentType === 'delta'}
          <InlineDelta
            value={aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol)}
            downIsGood={column.downIsGood}
            formatObject={baseFormat}
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
            aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol),
            format,
            summary.columnUnitSummary,
          )}
        {/if}
      {:else if groupType === 'section'}
        {groupName}
      {/if}
    </TableCell>
  {/each}
</tr>

<style>
  .subtotal-row {
    border-bottom: 1px solid rgba(107, 114, 128, 0.3);
    background: rgba(226, 232, 240, 0.6);
    font-weight: 600;
  }
</style>
