<script lang="ts">
  import SortIcon from './SortIcon.svelte'
  import {safeExtractColumn} from './tableUtils'
  import {toBoolean} from './utils'

  export let rowNumbers: boolean | string | undefined = false
  export let headerColor: string | undefined = undefined
  export let headerFontColor: string | undefined = undefined
  export let orderedColumns: any[] = []
  export let columnSummary: any[] = []
  export let sortable: boolean | string | undefined = true
  export let sortClick: (columnId: string) => () => void = () => () => {}
  export let formatColumnTitles: boolean | string | undefined = true
  export let sortObj: {col: string | null; ascending: boolean | null} = {col: null, ascending: null}
  export let wrapTitles: boolean | string | undefined = false
  export let compact: boolean | string | undefined = false
  export let link: string | undefined = undefined

  rowNumbers = toBoolean(rowNumbers) ?? false
  sortable = toBoolean(sortable) ?? true
  formatColumnTitles = toBoolean(formatColumnTitles) ?? true
  wrapTitles = toBoolean(wrapTitles) ?? false
  compact = toBoolean(compact) ?? false

  const getWrapTitleAlignment = (column: any) => {
    if (column.align === 'right') return 'header-title--align-end'
    if (column.align === 'center') return 'header-title--align-center'
    let extracted = safeExtractColumn(column, columnSummary)
    if (extracted.type === 'number') return 'header-title--align-end'
    return 'header-title--align-start'
  }

  const computeGroupSpans = () => {
    return orderedColumns.map((column, index, array) => {
      let isNewGroup = index === 0 || column.colGroup !== array[index - 1].colGroup
      let span = 1
      if (column.colGroup) {
        for (let i = index + 1; i < array.length && array[i].colGroup === column.colGroup; i++) span += 1
      }
      return {...column, isNewGroup, span: isNewGroup ? span : 0}
    })
  }

  $: columnsWithGroupSpan = computeGroupSpans()
</script>

<thead>
  {#if columnsWithGroupSpan.length}
    <tr class="header-group-row" style:background-color={headerColor}>
      {#if rowNumbers}
        <th class={`header-index ${compact ? 'header-index--compact' : ''}`} style:background-color={headerColor} />
      {/if}
      {#each columnsWithGroupSpan as column (column.id)}
        {#if column.colGroup && column.isNewGroup}
          <th class="header-group" colspan={column.span}>
            <div class="header-group__label">{column.colGroup}</div>
          </th>
        {:else}
          <th class="header-group--spacer" />
        {/if}
      {/each}
      {#if link}
        <th class="header-group--spacer" />
      {/if}
    </tr>
  {/if}

  <tr class="header-row">
    {#if rowNumbers}
      <th
        role="columnheader"
        class={`header-index ${compact ? 'header-index--compact' : ''}`}
        style:background-color={headerColor}
        style:color={headerFontColor}
      />
    {/if}
    {#each orderedColumns as column (column.id)}
      {@const summary = safeExtractColumn(column, columnSummary)}
      <th
        role="columnheader"
        class={`header-cell ${summary.type ?? ''} ${compact ? 'header-cell--compact' : ''}`}
        style:color={headerFontColor}
        style:background={headerColor}
        style:text-align={column.align ?? (['sparkline', 'sparkbar', 'sparkarea', 'bar'].includes(column.contentType) ? 'center' : undefined)}
        style:cursor={sortable ? 'pointer' : 'auto'}
        on:click={sortable ? sortClick(column.id) : undefined}
        aria-sort={sortObj.col === column.id ? (sortObj.ascending ? 'ascending' : 'descending') : 'none'}
      >
        <div class={`header-title ${wrapTitles || column.wrapTitle ? 'header-title--wrap' : ''} ${wrapTitles || column.wrapTitle ? getWrapTitleAlignment(column) : ''}`.trim()}>
          <span class={`header-title__text ${wrapTitles || column.wrapTitle ? 'header-title__text--wrap' : ''}`}>
            {column.title
              ? column.title
              : formatColumnTitles
                ? summary.title
                : summary.id}
            {#if column.description}
              <span class="header-title__info" title={column.description}>ⓘ</span>
            {/if}
          </span>
          <span class="header-sort-indicator">
            {#if sortObj.col === column.id}
              <SortIcon ascending={sortObj.ascending ?? undefined} />
            {:else}
              <span class="header-sort-placeholder"><SortIcon ascending /></span>
            {/if}
          </span>
        </div>
      </th>
    {/each}
    {#if link}
      <th class="header-link-cell"><span class="sr-only">Links</span></th>
    {/if}
  </tr>
</thead>

<style>
  thead {
    background: var(--table-header-background, inherit);
  }

  .header-group-row {
    height: 26px;
  }

  .header-group {
    padding: 0;
  }

  .header-group__label {
    padding: 4px 6px 2px;
    border-bottom: 1px solid rgba(107, 114, 128, 0.4);
    font-weight: 500;
    white-space: nowrap;
  }

  .header-group--spacer {
    padding: 0;
  }

  .header-row {
    border-bottom: 1px solid rgba(107, 114, 128, 0.6);
  }

  th {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .header-index {
    color: var(--color-base-content-muted, #6b7280);
    text-align: left;
    padding: 2px 8px 2px 3px;
    max-width: min-content;
  }

  .header-index--compact {
    padding: 1px 4px;
    font-size: 12px;
  }

  .header-cell {
    padding: 2px 13px 2px 6px;
    vertical-align: bottom;
  }

  .header-cell--compact {
    padding: 1px 6px 1px 1px;
    font-size: 12px;
  }

  .header-title {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 4px;
  }

  .header-title--wrap {
    align-items: stretch;
  }

  .header-title--align-end {
    justify-content: flex-end;
  }

  .header-title--align-center {
    justify-content: center;
  }

  .header-title--align-start {
    justify-content: flex-start;
  }

  .header-title__text {
    display: inline-block;
    letter-spacing: -0.015em;
  }

  .header-title__text--wrap {
    white-space: normal;
  }

  .header-title__info {
    margin-left: 4px;
    cursor: help;
    font-size: 0.75em;
    color: var(--color-base-content-muted, #6b7280);
  }

  .header-sort-indicator {
    display: inline-flex;
    align-items: center;
  }

  .header-sort-placeholder {
    visibility: hidden;
  }

  .header-link-cell {
    width: 24px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
