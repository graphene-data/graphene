<script lang="ts">
  import {writable} from 'svelte/store'
  import {setContext} from 'svelte'
  import {propKey, strictBuild} from '@evidence-dev/component-utilities/chartContext'
  import getColumnSummary from '@evidence-dev/component-utilities/getColumnSummary'
  import {convertColumnToDate} from '@evidence-dev/component-utilities/dateParsing'
  import checkInputs from '@evidence-dev/component-utilities/checkInputs'
  import ErrorChart from './ErrorChart.svelte'
  import TableHeader from './TableHeader.svelte'
  import TableRow from './TableRow.svelte'
  import TableGroupRow from './TableGroupRow.svelte'
  import TableSubtotalRow from './TableSubtotalRow.svelte'
  import TableTotalRow from './TableTotalRow.svelte'
  import Column from './Column.svelte'
  import {aggregateColumn, getFinalColumnOrder} from './tableUtils'
  import {getThemeStores} from './themeStores'
  import {toBoolean} from './utils'

  const {resolveColor} = getThemeStores()

  export let data: any[] = []
  export let rows: number | string = 10
  export let title: string | undefined = undefined
  export let subtitle: string | undefined = undefined
  export let rowNumbers: boolean | string | undefined = false
  export let sort: string | undefined = undefined
  export let sortable: boolean | string | undefined = true
  export let groupBy: string | undefined = undefined
  export let groupsOpen: boolean | string | undefined = true
  export let groupType: 'accordion' | 'section' = 'accordion'
  export let accordionRowColor: string | undefined = undefined
  export let groupNamePosition: 'top' | 'middle' | 'bottom' = 'middle'
  export let subtotals: boolean | string | undefined = false
  export let subtotalRowColor: string | undefined = undefined
  export let subtotalFontColor: string | undefined = undefined
  export let rowShading: boolean | string | undefined = false
  export let rowLines: boolean | string | undefined = true
  export let wrapTitles: boolean | string | undefined = false
  export let headerColor: string | undefined = undefined
  export let headerFontColor: string | undefined = undefined
  export let formatColumnTitles: boolean | string | undefined = true
  export let backgroundColor: string | undefined = undefined
  export let compact: boolean | string | undefined = undefined
  export let link: string | undefined = undefined
  export let showLinkCol: boolean | string | undefined = false
  export let totalRow: boolean | string | undefined = false
  export let totalRowColor: string | undefined = undefined
  export let totalFontColor: string | undefined = undefined
  export let emptyMessage: string | undefined = undefined
  export let isFullPage: boolean | string | undefined = undefined

  rows = Number.parseInt(String(rows), 10)
  if (!Number.isFinite(rows) || rows <= 0) rows = 10

  rowNumbers = toBoolean(rowNumbers) ?? false
  groupsOpen = toBoolean(groupsOpen) ?? true
  subtotals = toBoolean(subtotals) ?? false
  rowShading = toBoolean(rowShading) ?? false
  rowLines = toBoolean(rowLines) ?? true
  wrapTitles = toBoolean(wrapTitles) ?? false
  formatColumnTitles = toBoolean(formatColumnTitles) ?? true
  compact = toBoolean(compact)
  showLinkCol = toBoolean(showLinkCol) ?? false
  totalRow = toBoolean(totalRow) ?? false
  sortable = toBoolean(sortable) ?? true
  isFullPage = toBoolean(isFullPage) ?? false

  if (groupType === 'section') rowNumbers = false

  const props = writable<{data: any[]; columns: any[]; priorityColumns: (string | undefined)[]}>({data, columns: [], priorityColumns: [groupBy]})
  setContext(propKey, props)

  $: props.update((state) => ({...state, data, priorityColumns: [groupBy]}))

  $: accordionRowColorStore = resolveColor(accordionRowColor)
  $: subtotalRowColorStore = resolveColor(subtotalRowColor)
  $: subtotalFontColorStore = resolveColor(subtotalFontColor)
  $: totalRowColorStore = resolveColor(totalRowColor)
  $: totalFontColorStore = resolveColor(totalFontColor)
  $: headerColorStore = resolveColor(headerColor)
  $: headerFontColorStore = resolveColor(headerFontColor)
  $: backgroundColorStore = resolveColor(backgroundColor)

  let error: string | undefined = undefined
  let columnSummary: any[] = []
  let priorityColumns: (string | undefined)[] = [groupBy]
  let finalColumnOrder: string[] = []
  let orderedColumns: any[] = []

  $: priorityColumns = [groupBy]
  $: props.update((state) => ({...state, priorityColumns}))
  $: finalColumnOrder = getFinalColumnOrder(($props.columns ?? []).map((column: any) => column.id), priorityColumns)
  $: orderedColumns = [...($props.columns ?? [])].sort(
    (a, b) => finalColumnOrder.indexOf(a.id) - finalColumnOrder.indexOf(b.id)
  )

  let sortObj: {col: string | null; ascending: boolean | null} = {col: null, ascending: null}
  let sortBy: string | undefined
  let sortAsc: boolean | undefined

  $: if (sort) {
    const [column, direction] = sort.split(/\s+/)
    sortBy = column
    if (direction) {
      sortAsc = direction.toLowerCase() !== 'desc'
    } else {
      sortAsc = true
    }
    sortObj = sortBy ? {col: sortBy, ascending: sortAsc ?? true} : {col: null, ascending: null}
  }

  $: props.update((state) => ({...state, data}))

  $: try {
    error = undefined
    checkInputs(Array.isArray(data) ? data : [])
    columnSummary = getColumnSummary(data ?? [], 'array')

    if (sortBy) {
      const columnNames = columnSummary.map((col) => col.id)
      if (!columnNames.includes(sortBy)) {
        throw new Error(`${sortBy} is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).`)
      }
    }

    const dateCols = columnSummary
      .filter((col) => col.type === 'date' && !(data?.[0]?.[col.id] instanceof Date))
      .map((col) => col.id)

    for (const columnId of dateCols) {
      data = convertColumnToDate(data, columnId)
    }

    if (link && !showLinkCol) {
      const linkIndex = columnSummary.findIndex((col) => col.id === link)
      if (linkIndex !== -1) {
        columnSummary = [...columnSummary.slice(0, linkIndex), ...columnSummary.slice(linkIndex + 1)]
      }
    }
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : 'Unable to prepare dataset'
    error = message
    if (strictBuild) throw thrown
  }

  let paginated = false
  let currentPage = 1
  let pageCount = 1
  let displayedPageLength = 0

  const goToPage = (page: number) => {
    if (!paginated) return
    const next = Math.min(Math.max(page, 1), pageCount)
    if (Number.isFinite(next)) currentPage = next
  }

  let groupedData: Record<string, any[]> = {}
  let groupRowData: Record<string, Record<string, unknown>> = {}
  let groupToggleStates: Record<string, boolean> = {}

  const coerceId = (value: any) => {
    if (value === undefined || value === null || value === '') return undefined
    return String(value)
  }

  let dataTestId: string | undefined = undefined

  $: {
    if (!Array.isArray(data)) {
      const raw = data as any
      dataTestId = coerceId(raw?.id)
      const candidate = raw?.rows
      data = Array.isArray(candidate) ? candidate : []
    } else {
      dataTestId = coerceId((data as any)?.id)
    }
  }

  $: paginated = !groupBy && rows > 0 && (data?.length ?? 0) > rows
  $: pageCount = paginated ? Math.ceil((data?.length ?? 0) / rows) : 1
  $: currentPage = Math.min(Math.max(currentPage, 1), pageCount)
  $: displayedPageLength = paginated
    ? Math.min(rows, (data?.length ?? 0) - rows * (currentPage - 1))
    : data?.length ?? 0

  $: if (groupBy && data) {
    groupedData = data.reduce<Record<string, any[]>>((acc, row) => {
      const groupName = row[groupBy]
      const key = groupName ?? '(blank)'
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {})

    for (const groupName of Object.keys(groupedData)) {
      if (!(groupName in groupToggleStates)) groupToggleStates[groupName] = groupsOpen ?? true
    }

    groupRowData = Object.fromEntries(
      Object.entries(groupedData).map(([groupName, rows]) => {
        const aggregates: Record<string, unknown> = {}
        for (const column of orderedColumns) {
          const summary = columnSummary.find((col) => col.id === column.id)
          aggregates[column.id] = aggregateColumn(rows, column.id, column.totalAgg, summary?.type, column.weightCol)
        }
        return [groupName, aggregates]
      })
    )
  } else {
    groupedData = {}
    groupRowData = {}
  }

  const handleToggle = (event: CustomEvent<{groupName: string}>) => {
    const {groupName} = event.detail
    groupToggleStates = {...groupToggleStates, [groupName]: !groupToggleStates[groupName]}
  }

  const activeRows = () => {
    if (groupBy) return data ?? []
    if (!paginated) return data ?? []
    const start = rows * (currentPage - 1)
    const end = start + rows
    return data?.slice(start, end) ?? []
  }

  let lastSortedReference: any[] | undefined = undefined

  const applySort = (state: {col: string | null; ascending: boolean | null}) => {
    if (!state.col) return
    const ascending = state.ascending ?? true
    if (groupBy) {
      groupedData = Object.fromEntries(
        Object.entries(groupedData).map(([groupName, rows]) => [
          groupName,
          [...rows].sort((a, b) => compareValues(a[state.col as string], b[state.col as string], ascending))
        ])
      )
    } else {
      const sorted = [...(data ?? [])].sort((a, b) => compareValues(a[state.col as string], b[state.col as string], ascending))
      data = sorted
      lastSortedReference = sorted
    }
  }

  const sortClick = (column: string) => () => {
    if (!sortable) return
    if (!column) return
    if (sortObj.col === column) {
      sortObj = {col: column, ascending: !sortObj.ascending}
    } else {
      sortObj = {col: column, ascending: true}
    }
    applySort(sortObj)
  }

  const compareValues = (a: unknown, b: unknown, ascending: boolean) => {
    const modifier = ascending ? 1 : -1
    if (a === b) return 0
    if (a === undefined || a === null) return -1 * modifier
    if (b === undefined || b === null) return 1 * modifier
    if (typeof a === 'number' && typeof b === 'number') {
      return a < b ? -1 * modifier : 1 * modifier
    }
    const valA = String(a).toLowerCase()
    const valB = String(b).toLowerCase()
    if (valA < valB) return -1 * modifier
    if (valA > valB) return 1 * modifier
    return 0
  }

  $: if (data && sortObj.col && data !== lastSortedReference) {
    applySort(sortObj)
  }

  $: sortedGroupNames = groupBy
    ? Object.keys(groupedData).sort((a, b) => a.localeCompare(b))
    : []

  let groupOffsets: Record<string, number> = {}
  $: if (groupBy) {
    let running = 0
    groupOffsets = {}
    for (const name of sortedGroupNames) {
      groupOffsets[name] = running
      running += groupedData[name]?.length ?? 0
    }
  } else {
    groupOffsets = {}
  }

  const totalRows = data?.length ?? 0
  $: tableData = data ?? []
</script>

{#if !error}
  <slot>
    {#each columnSummary as column}
      <Column id={column.id} />
    {/each}
  </slot>

  <div
    class={`table-container ${paginated ? 'table-container--has-pagination' : ''}`}
    data-testid={isFullPage ? undefined : `DataTable-${dataTestId ?? 'no-id'}`}
  >
    {#if title || subtitle}
      <div class="table-title">
        {#if title}<div class="table-title__headline">{title}</div>{/if}
        {#if subtitle}<div class="table-title__subhead">{subtitle}</div>{/if}
      </div>
    {/if}

    <div class="scrollbox" style:background-color={$backgroundColorStore}>
      <table>
        <TableHeader
          {rowNumbers}
          headerColor={$headerColorStore}
          headerFontColor={$headerFontColorStore}
          {orderedColumns}
          {columnSummary}
          {sortable}
          {sortClick}
          {formatColumnTitles}
          {sortObj}
          {wrapTitles}
          {compact}
          link={link}
        />

        {#if groupBy}
          {#each sortedGroupNames as groupName}
            <TableGroupRow
              {groupName}
              currentGroupData={groupedData[groupName]}
              toggled={groupToggleStates[groupName]}
              {columnSummary}
              {rowNumbers}
              rowColor={$accordionRowColorStore}
              {subtotals}
              on:toggle={handleToggle}
              {orderedColumns}
              {compact}
            />
            {#if groupToggleStates[groupName]}
              <TableRow
                displayedData={groupedData[groupName]}
                {rowShading}
                {link}
                {rowNumbers}
                {rowLines}
                {compact}
                {columnSummary}
                grouped={true}
                {groupType}
                groupColumn={groupBy}
                groupNamePosition={groupNamePosition}
                orderedColumns={orderedColumns}
                index={groupOffsets[groupName] ?? 0}
              />
              {#if subtotals}
                <TableSubtotalRow
                  {groupName}
                  currentGroupData={groupedData[groupName]}
                  {columnSummary}
                  rowColor={$subtotalRowColorStore}
                  fontColor={$subtotalFontColorStore}
                  groupBy={groupBy}
                  groupType={groupType}
                  {orderedColumns}
                  {compact}
                />
              {/if}
            {/if}
          {/each}
        {:else}
          <TableRow
            displayedData={activeRows()}
            {rowShading}
            {link}
            {rowNumbers}
            {rowLines}
            {compact}
            {columnSummary}
            grouped={false}
            {groupType}
            groupColumn={groupBy}
            groupNamePosition={groupNamePosition}
            orderedColumns={orderedColumns}
            index={rows * (currentPage - 1)}
          />
        {/if}

        {#if totalRow && !groupBy}
          <TableTotalRow
            data={tableData}
            {rowNumbers}
            {columnSummary}
            rowColor={$totalRowColorStore}
            fontColor={$totalFontColorStore}
            groupType={groupType}
            {orderedColumns}
            {compact}
          />
        {/if}
      </table>
    </div>

    {#if paginated && pageCount > 1}
      <div class="pagination">
        <button class="pagination__button" disabled={currentPage === 1} on:click={() => goToPage(1)}>First</button>
        <button class="pagination__button" disabled={currentPage === 1} on:click={() => goToPage(currentPage - 1)}>Prev</button>
        <div class="pagination__status">
          Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}
        </div>
        <button class="pagination__button" disabled={currentPage === pageCount} on:click={() => goToPage(currentPage + 1)}>Next</button>
        <button class="pagination__button" disabled={currentPage === pageCount} on:click={() => goToPage(pageCount)}>Last</button>
        <div class="pagination__meta">{displayedPageLength.toLocaleString()} of {totalRows.toLocaleString()} rows</div>
      </div>
    {/if}
  </div>
{:else}
  <ErrorChart title="Data Table" error={error ?? emptyMessage ?? 'Unable to render table'} />
{/if}

<style>
  .table-container {
    font-size: 9.5pt;
    margin: 16px 0;
    position: relative;
  }

  .table-container--has-pagination {
    padding-bottom: 24px;
  }

  .table-title {
    margin-bottom: 8px;
  }

  .table-title__headline {
    font-weight: 600;
    font-size: 16px;
    line-height: 1.3;
  }

  .table-title__subhead {
    color: var(--color-base-content-muted, #6b7280);
    font-size: 13px;
    margin-top: 2px;
  }

  .scrollbox {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--color-base-content-muted, #6b7280);
  }

  .pagination__button {
    padding: 4px 8px;
    border: 1px solid rgba(107, 114, 128, 0.4);
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background 0.2s ease-in-out;
  }

  .pagination__button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .pagination__button:not(:disabled):hover {
    background: rgba(229, 231, 235, 0.6);
  }

  .pagination__status {
    margin: 0 8px;
  }

  .pagination__meta {
    margin-left: auto;
  }
</style>
