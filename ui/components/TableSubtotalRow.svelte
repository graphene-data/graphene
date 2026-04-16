<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import {summarizeColumn, type SummaryMetric} from '../component-utilities/dataSummary.ts'
  import {formatFromField} from '../component-utilities/format.ts'
  import TableCell from './TableCell.svelte'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    groupName?: string
    currentGroupData?: any[]
    rowColor?: string
    groupBy?: string
    groupType?: 'accordion' | 'section'
    rowNumbers?: boolean | string
    fontColor?: string
    orderedColumns?: any[]
    compact?: boolean | string
  }

  let {
    groupName = undefined, currentGroupData = [], rowColor = undefined,
    groupBy = undefined, groupType = undefined, rowNumbers: rowNumbersProp = undefined,
    fontColor = undefined, orderedColumns = [], compact = undefined,
  }: Props = $props()

  let rowNumbers = $derived(toBoolean(rowNumbersProp) ?? false)

  const SUPPORTED_METRICS: SummaryMetric[] = ['sum', 'mean', 'median', 'min', 'max', 'count', 'countDistinct']

  const getAggregateValue = (rows: Record<string, unknown>[], column: any) => {
    let metric = column?.totalAgg as SummaryMetric | undefined
    if (!metric && String(column?.type || '').toLowerCase() === 'number') metric = 'sum'
    if (!metric || !SUPPORTED_METRICS.includes(metric)) return '-'
    let summary = summarizeColumn(rows, column.field ?? {name: column.id, type: column.type}, [metric])
    return summary[metric] ?? null
  }
</script>

<tr class="subtotal-row" style:background-color={rowColor} style:color={fontColor}>
  {#if rowNumbers && groupType !== 'section'}
    <TableCell class="index" {compact}></TableCell>
  {/if}
  {#each orderedColumns as column (column.id)}
    <TableCell class={column.type} {compact} align={column.align}>
      {#if column.id !== groupBy}
        {#if column.contentType === 'delta'}
          <InlineDelta
            value={getAggregateValue(currentGroupData, column)}
            downIsGood={column.downIsGood}
            field={column.field}
            showValue={column.showValue}
            showSymbol={column.deltaSymbol}
            align={column.align}
            neutralMin={column.neutralMin ?? 0}
            neutralMax={column.neutralMax ?? 0}
            chip={column.chip}
          />
        {:else}
          {formatFromField(column.field, getAggregateValue(currentGroupData, column))}
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
