<script lang="ts">
  import SortIcon from './SortIcon.svelte'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    rowNumbers?: boolean | string
    headerColor?: string
    headerFontColor?: string
    orderedColumns?: any[]
    sortable?: boolean | string
    sortClick?: (columnId: string) => () => void
    formatColumnTitles?: boolean | string
    sortObj?: {col: string | null; ascending: boolean | null}
    wrapTitles?: boolean | string
    compact?: boolean | string
    link?: string
  }

  let {
    rowNumbers: rowNumbersProp = false, headerColor = undefined, headerFontColor = undefined,
    orderedColumns = [], sortable: sortableProp = true, sortClick = () => () => {},
    formatColumnTitles: formatColumnTitlesProp = true, sortObj = {col: null, ascending: null},
    wrapTitles: wrapTitlesProp = false, compact: compactProp = false, link = undefined,
  }: Props = $props()

  let rowNumbers = $derived(toBoolean(rowNumbersProp) ?? false)
  let sortable = $derived(toBoolean(sortableProp) ?? true)
  let formatColumnTitles = $derived(toBoolean(formatColumnTitlesProp) ?? true)
  let wrapTitles = $derived(toBoolean(wrapTitlesProp) ?? false)
  let compact = $derived(toBoolean(compactProp) ?? false)

  const getHeaderAlignment = (column: any) => {
    if (column.align) return column.align
    if (['sparkline', 'sparkbar', 'sparkarea', 'bar'].includes(column.contentType)) return 'center'
    if (column.type === 'number') return 'right'
    return 'left'
  }

  const computeGroupSpans = (columns: any[]) => {
    return columns.map((column, index, array) => {
      let isNewGroup = index === 0 || column.colGroup !== array[index - 1].colGroup
      let span = 1
      if (column.colGroup) {
        for (let i = index + 1; i < array.length && array[i].colGroup === column.colGroup; i++) span += 1
      }
      return {...column, isNewGroup, span: isNewGroup ? span : 0}
    })
  }

  const getAriaSortValue = (columnId: string) => {
    if (sortObj.col !== columnId) return 'none'
    return sortObj.ascending ? 'ascending' : 'descending'
  }

  const resolveHeaderTitle = (column: any) => {
    if (column.title) return column.title
    if (formatColumnTitles) return column.defaultTitle ?? column.id
    return column.id
  }

  let columnsWithGroupSpan = $derived(computeGroupSpans(orderedColumns))
  let hasColumnGroups = $derived(orderedColumns.some((col) => col.colGroup))
</script>

<thead>
  {#if hasColumnGroups}
    <tr class="header-group-row" style:background-color={headerColor}>
      {#if rowNumbers}
        <th class={`header-index ${compact ? 'header-index--compact' : ''}`} style:background-color={headerColor}></th>
      {/if}
      {#each columnsWithGroupSpan as column (column.id)}
        {#if column.colGroup && column.isNewGroup}
          <th class="header-group" colspan={column.span}>
            <div class="header-group__label">{column.colGroup}</div>
          </th>
        {:else}
          <th class="header-group--spacer"></th>
        {/if}
      {/each}
      {#if link}
        <th class="header-group--spacer"></th>
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
      ></th>
    {/if}
    {#each orderedColumns as column (column.id)}
      <th
        role="columnheader"
        class={`header-cell ${column.type ?? ''} ${compact ? 'header-cell--compact' : ''}`}
        style:color={headerFontColor}
        style:background={headerColor}
        style:text-align={getHeaderAlignment(column)}
        style:cursor={sortable ? 'pointer' : 'auto'}
        onclick={sortable ? sortClick(column.id) : undefined}
        aria-sort={getAriaSortValue(column.id)}
      >
        <span class={`header-title__text ${wrapTitles || column.wrapTitle ? 'header-title__text--wrap' : ''}`}>
          {resolveHeaderTitle(column)}
          {#if column.description}
            <span class="header-title__info" title={column.description}>ⓘ</span>
          {/if}
        </span>
        {#if sortObj.col === column.id}
          <span class="header-sort-indicator">
            <SortIcon ascending={sortObj.ascending ?? undefined} />
          </span>
        {/if}
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
    position: relative;
    padding: 2px 13px 2px 6px;
    vertical-align: bottom;
  }

  .header-cell--compact {
    padding: 1px 16.5px 1px 1px;
    font-size: 12px;
  }

  .header-title__text {
    display: inline-block;
    max-width: 100%;
    text-align: inherit;
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
    position: absolute;
    right: 1px;
    bottom: 4px;
    display: inline-flex;
    align-items: center;
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
