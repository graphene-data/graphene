<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import {aggregateColumn, safeExtractColumn} from '../component-utilities/tableUtils'
  import {formatFromField} from '../component-utilities/format.ts'
  import TableCell from './TableCell.svelte'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    groupName?: string
    currentGroupData?: any[]
    columnSummary?: any[]
    rowColor?: string
    groupBy?: string
    groupType?: 'accordion' | 'section'
    rowNumbers?: boolean | string
    fontColor?: string
    orderedColumns?: any[]
    compact?: boolean | string
  }

  let {
    groupName = undefined, currentGroupData = [], columnSummary = [], rowColor = undefined,
    groupBy = undefined, groupType = undefined, rowNumbers: rowNumbersProp = undefined,
    fontColor = undefined, orderedColumns = [], compact = undefined,
  }: Props = $props()

  let rowNumbers = $derived(toBoolean(rowNumbersProp) ?? false)
</script>

<tr class="subtotal-row" style:background-color={rowColor} style:color={fontColor}>
  {#if rowNumbers && groupType !== 'section'}
    <TableCell class="index" {compact}></TableCell>
  {/if}
  {#each orderedColumns as column (column.id)}
    {@const summary = safeExtractColumn(column, columnSummary)}
    <TableCell class={summary.type} {compact} align={column.align}>
      {#if column.id !== groupBy}
        {#if column.contentType === 'delta'}
          <InlineDelta
            value={aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol)}
            downIsGood={column.downIsGood}
            field={summary.field}
            showValue={column.showValue}
            showSymbol={column.deltaSymbol}
            align={column.align}
            neutralMin={column.neutralMin ?? 0}
            neutralMax={column.neutralMax ?? 0}
            chip={column.chip}
          />
        {:else}
          {formatFromField(summary.field, aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol))}
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
