<script lang="ts">
  import {createEventDispatcher} from 'svelte'
  import TableCell from './TableCell.svelte'
  import TableGroupToggle from './TableGroupToggle.svelte'
  import InlineDelta from './InlineDelta.svelte'
  import {aggregateColumn, safeExtractColumn} from '../component-utilities/tableUtils'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {toBoolean} from '../component-utilities/convert'

  export let groupName: string
  export let currentGroupData: any[] = []
  export let toggled = true
  export let columnSummary: any[] = []
  export let rowNumbers: boolean | string | undefined = undefined
  export let rowColor: string | undefined = undefined
  export let subtotals: boolean | string | undefined = true
  export let orderedColumns: any[] = []
  export let compact: boolean | string | undefined = undefined

  rowNumbers = toBoolean(rowNumbers) ?? false
  subtotals = toBoolean(subtotals) ?? true
  compact = toBoolean(compact)

  const dispatch = createEventDispatcher<{toggle: {groupName: string}}>()
  const toggleGroup = () => dispatch('toggle', {groupName})

  const resolveFormat = (column, summary) => {
    if (column.subtotalFmt) return getFormatObjectFromString(column.subtotalFmt)
    if (column.totalFmt) return getFormatObjectFromString(column.totalFmt)
    if (column.fmt) return getFormatObjectFromString(column.fmt, summary.format?.valueType)
    return summary.format
  }
</script>

<tr
  class="group-row"
  role="row"
  tabindex="0"
  on:click={toggleGroup}
  on:keypress={(event) => (event.key === 'Enter' || event.key === ' ') && toggleGroup()}
  style:background-color={rowColor}
>
  {#if rowNumbers}
    <TableCell class="group-row__label" {compact} colSpan={2}>
      <div class="group-row__title">
        <span class="group-row__icon"><TableGroupToggle {toggled} /></span>
        {groupName}
      </div>
    </TableCell>
  {/if}

  {#each orderedColumns as column, index (index)}
    {@const summary = safeExtractColumn(column, columnSummary)}
    {@const format = resolveFormat(column, summary)}
    {#if index === 0}
      {#if rowNumbers}
        <!-- Covered by the row-number label cell -->
      {:else}
      <TableCell class="group-row__label" {compact} paddingLeft="1px">
        <div class="group-row__title">
          <span class="group-row__icon"><TableGroupToggle {toggled} /></span>
          {groupName}
        </div>
      </TableCell>
      {/if}
    {:else if subtotals}
      <TableCell class={summary.type} {compact} align={column.align}>
        {#if ['sum', 'mean', 'median', 'min', 'max', 'weightedMean', 'count', 'countDistinct', undefined].includes(column.totalAgg) || column.subtotalFmt}
          {#if column.contentType === 'delta'}
            <InlineDelta
              value={aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol)}
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
              aggregateColumn(currentGroupData, column.id, column.totalAgg, summary.type, column.weightCol),
              format,
              summary.columnUnitSummary,
            )}
          {/if}
        {:else}
          {column.totalAgg}
        {/if}
      </TableCell>
    {:else}
      <TableCell />
    {/if}
  {/each}
</tr>

<style>
  .group-row {
    font-weight: 600;
    border-top: 1px solid rgba(229, 231, 235, 1);
    cursor: pointer;
  }

  .group-row:focus {
    outline: 2px solid var(--color-primary, #2563eb);
    outline-offset: 1px;
  }

  .group-row__label {
    padding: 3px 6px;
  }

  .group-row__title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .group-row__icon {
    display: inline-flex;
  }

  @media print {
    .group-row__icon {
      display: none;
    }
  }
</style>
