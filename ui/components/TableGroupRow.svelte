<script lang="ts">
  import TableCell from './TableCell.svelte'
  import TableGroupToggle from './TableGroupToggle.svelte'
  import InlineDelta from './InlineDelta.svelte'
  import {aggregateColumn, safeExtractColumn} from '../component-utilities/tableUtils'
  import {formatFromField} from '../component-utilities/format.ts'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    groupName: string
    currentGroupData?: any[]
    toggled?: boolean
    columnSummary?: any[]
    rowNumbers?: boolean | string
    rowColor?: string
    subtotals?: boolean | string
    orderedColumns?: any[]
    compact?: boolean | string
    onToggle?: (detail: {groupName: string}) => void
  }

  let {
    groupName, currentGroupData = [], toggled = true, columnSummary = [],
    rowNumbers: rowNumbersProp = undefined, rowColor = undefined, subtotals: subtotalsProp = true,
    orderedColumns = [], compact: compactProp = undefined, onToggle,
  }: Props = $props()

  let rowNumbers = $derived(toBoolean(rowNumbersProp) ?? false)
  let subtotals = $derived(toBoolean(subtotalsProp) ?? true)
  let compact = $derived(toBoolean(compactProp))

  const toggleGroup = () => onToggle?.({groupName})

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleGroup()
    }
  }

</script>

<tr
  class="group-row"
  tabindex="0"
  onclick={toggleGroup}
  onkeydown={handleKeydown}
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
        {#if ['sum', 'mean', 'median', 'min', 'max', 'weightedMean', 'count', 'countDistinct', undefined].includes(column.totalAgg)}
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
        {:else}
          {column.totalAgg}
        {/if}
      </TableCell>
    {:else}
      <TableCell></TableCell>
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

  :global(.group-row__label) {
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
