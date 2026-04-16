<script lang="ts">
  import InlineDelta from './InlineDelta.svelte'
  import TableCell from './TableCell.svelte'
  import {summarizeColumn, type SummaryMetric} from '../component-utilities/dataSummary.ts'
  import {formatFromField} from '../component-utilities/format.ts'

  interface Props {
    data?: any[]
    rowNumbers?: boolean | string
    rowColor?: string
    fontColor?: string
    groupType?: 'accordion' | 'section'
    orderedColumns?: any[]
    compact?: boolean | string
  }

  let {
    data = [], rowNumbers: rowNumbersProp = undefined, rowColor = undefined,
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

  const SUPPORTED_METRICS: SummaryMetric[] = ['sum', 'mean', 'median', 'min', 'max', 'count', 'countDistinct']

  const getAggregateValue = (rows: Record<string, unknown>[], column: any, aggType: string | undefined) => {
    let metric = aggType as SummaryMetric | undefined
    if (!metric && String(column?.type || '').toLowerCase() === 'number') metric = 'sum'
    if (!metric || !SUPPORTED_METRICS.includes(metric)) return '-'
    let summary = summarizeColumn(rows, column.field ?? {name: column.id, type: column.type}, [metric])
    return summary[metric] ?? null
  }
</script>

<tr class="total-row" style:background-color={rowColor} style:color={fontColor}>
  {#if rowNumbers && groupType !== 'section'}
    <TableCell class="index" {compact} topBorder="1px solid rgba(107, 114, 128, 0.5)"></TableCell>
  {/if}

  {#each orderedColumns as column (column.id)}
    {@const totalAgg = column.totalAgg ?? 'sum'}
    <TableCell
      {compact}
      dataType={column.type}
      align={column.align}
      height={column.height}
      width={column.width}
      wrap={column.wrap}
      topBorder="1px solid rgba(107, 114, 128, 0.5)"
    >
      {#if column.contentType === 'delta'}
        <InlineDelta
          value={getAggregateValue(data, column, totalAgg)}
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
        {formatFromField(column.field, getAggregateValue(data, column, totalAgg))}
      {/if}
    </TableCell>
  {/each}
</tr>

<style>
  .total-row {
    font-weight: 600;
  }
</style>
