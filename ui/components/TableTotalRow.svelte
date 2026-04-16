<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import TableCell from './TableCell.svelte'
  import {safeExtractColumn, weightedMean} from '../component-utilities/tableUtils'
  import {formatFromField} from '../component-utilities/format.ts'

  interface Props {
    data?: any[]
    rowNumbers?: boolean | string
    columnSummary?: any[]
    rowColor?: string
    fontColor?: string
    groupType?: 'accordion' | 'section'
    orderedColumns?: any[]
    compact?: boolean | string
  }

  let {
    data = [], rowNumbers: rowNumbersProp = undefined, columnSummary = [], rowColor = undefined,
    fontColor = undefined, groupType = undefined, orderedColumns = [], compact: compactProp = undefined,
  }: Props = $props()

  const toBool = (value: boolean | string | undefined) => {
    if (value === undefined) return false
    if (typeof value === 'string') {
      let normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return Boolean(value)
  }

  let rowNumbers = $derived(toBool(rowNumbersProp))
  let compact = $derived(toBool(compactProp))
</script>

<tr class="total-row" style:background-color={rowColor} style:color={fontColor}>
  {#if rowNumbers && groupType !== 'section'}
    <TableCell class="index" {compact} topBorder="1px solid rgba(107, 114, 128, 0.5)"></TableCell>
  {/if}

  {#each orderedColumns as column (column.id)}
    {@const summary = safeExtractColumn(column, columnSummary)}
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
            field={summary.field}
            showValue={column.showValue}
            showSymbol={column.deltaSymbol}
            align={column.align}
            neutralMin={column.neutralMin ?? 0}
            neutralMax={column.neutralMax ?? 0}
            chip={column.chip}
          />
        {:else}
          {formatFromField(summary.field, totalAgg === 'weightedMean' ? weightedMean(data, column.id, column.weightCol) : summary.columnUnitSummary?.[totalAgg])}
        {/if}
      {:else}
        {totalAgg}
      {/if}
    </TableCell>
  {/each}
</tr>

<style>
  .total-row {
    font-weight: 600;
  }
</style>
