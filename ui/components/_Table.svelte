<script lang="ts">
  import {setContext, untrack, type Snippet} from 'svelte'
  import {writable} from 'svelte/store'
  import {propKey, strictBuild} from '../component-utilities/chartContext.js'
  import getColumnSummary from '../component-utilities/getColumnSummary.js'
  import {convertColumnToDate} from '../component-utilities/dateParsing.js'
  import checkInputs from '../component-utilities/checkInputs.js'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import TableHeader from './TableHeader.svelte'
  import TableRow from './TableRow.svelte'
  import TableGroupRow from './TableGroupRow.svelte'
  import TableSubtotalRow from './TableSubtotalRow.svelte'
  import TableTotalRow from './TableTotalRow.svelte'
  import Column from './Column.svelte'
  import {getFinalColumnOrder} from '../component-utilities/tableUtils'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/convert'
  import {logError} from '../internal/telemetry.js'

  interface Props {
    data?: any[], rows?: number | string, title?: string, subtitle?: string, rowNumbers?: boolean | string
    sort?: string, sortable?: boolean | string, groupBy?: string, groupsOpen?: boolean | string
    groupType?: 'accordion' | 'section', accordionRowColor?: string, groupNamePosition?: 'top' | 'middle' | 'bottom'
    subtotals?: boolean | string, subtotalRowColor?: string, subtotalFontColor?: string
    rowShading?: boolean | string, rowLines?: boolean | string, wrapTitles?: boolean | string
    headerColor?: string, headerFontColor?: string, formatColumnTitles?: boolean | string
    backgroundColor?: string, compact?: boolean | string, link?: string, showLinkCol?: boolean | string
    totalRow?: boolean | string, totalRowColor?: string, totalFontColor?: string, emptyMessage?: string
    isFullPage?: boolean | string, children?: Snippet
  }

  const {resolveColor} = getThemeStores()

  let {
    data = [], rows = 10, title = undefined, subtitle = undefined, rowNumbers = false, sort = undefined,
    sortable = true, groupBy = undefined, groupsOpen = true, groupType = 'accordion',
    accordionRowColor = undefined, groupNamePosition = 'middle', subtotals = false,
    subtotalRowColor = undefined, subtotalFontColor = undefined, rowShading = false, rowLines = true,
    wrapTitles = false, headerColor = undefined, headerFontColor = undefined, formatColumnTitles = true,
    backgroundColor = undefined, compact = undefined, link = undefined, showLinkCol = false,
    totalRow = false, totalRowColor = undefined, totalFontColor = undefined, emptyMessage = undefined,
    isFullPage = undefined, children,
  }: Props = $props()

  let rowsNum = $derived.by(() => {
    let parsed = Number.parseInt(String(rows), 10)
    return (!Number.isFinite(parsed) || parsed <= 0) ? 10 : parsed
  })

  let rowNumbersBool = $derived(toBoolean(rowNumbers) ?? false)
  let groupsOpenBool = $derived(toBoolean(groupsOpen) ?? true)
  let subtotalsBool = $derived(toBoolean(subtotals) ?? false)
  let rowShadingBool = $derived(toBoolean(rowShading) ?? false)
  let rowLinesBool = $derived(toBoolean(rowLines) ?? true)
  let wrapTitlesBool = $derived(toBoolean(wrapTitles) ?? false)
  let formatColumnTitlesBool = $derived(toBoolean(formatColumnTitles) ?? true)
  let compactBool = $derived(toBoolean(compact))
  let showLinkColBool = $derived(toBoolean(showLinkCol) ?? false)
  let totalRowBool = $derived(toBoolean(totalRow) ?? false)
  let sortableBool = $derived(toBoolean(sortable) ?? true)
  let isFullPageBool = $derived(toBoolean(isFullPage) ?? false)

  let effectiveRowNumbers = $derived(groupType === 'section' ? false : rowNumbersBool)

  // Initialize store without data - it will be populated by the effect below
  const tablePropsStore = writable<{data: any[]; columns: any[]; priorityColumns:(string | undefined)[]}>({data: [], columns: [], priorityColumns: []})
  setContext(propKey, tablePropsStore)

  // Update store when data or groupBy changes
  $effect(() => {
    // Track data and groupBy
    let currentData = data
    let currentGroupBy = groupBy
    untrack(() => {
      tablePropsStore.update((state) => ({...state, data: currentData, priorityColumns: [currentGroupBy]}))
    })
  })

  let accordionRowColorStore = $derived(resolveColor(accordionRowColor))
  let subtotalRowColorStore = $derived(resolveColor(subtotalRowColor))
  let subtotalFontColorStore = $derived(resolveColor(subtotalFontColor))
  let totalRowColorStore = $derived(resolveColor(totalRowColor))
  let totalFontColorStore = $derived(resolveColor(totalFontColor))
  let headerColorStore = $derived(resolveColor(headerColor))
  let headerFontColorStore = $derived(resolveColor(headerFontColor))
  let backgroundColorStore = $derived(resolveColor(backgroundColor))

  let priorityColumns = $derived<(string | undefined)[]>([groupBy])

  $effect(() => {
    void priorityColumns
    untrack(() => {
      tablePropsStore.update((state) => ({...state, priorityColumns}))
    })
  })

  // Use $derived to reactively read from the store
  let tablePropsColumns = $derived($tablePropsStore.columns ?? [])

  let finalColumnOrder = $derived(getFinalColumnOrder(tablePropsColumns.map((column: any) => column.id), priorityColumns))
  let orderedColumns = $derived([...tablePropsColumns].sort(
    (a, b) => finalColumnOrder.indexOf(a.id) - finalColumnOrder.indexOf(b.id),
  ))

  let sortObj: {col: string | null; ascending: boolean | null} = $state({col: null, ascending: null})

  // Parse initial sort on mount
  let initialSort = $derived.by(() => {
    if (!sort) return {sortBy: undefined, sortAsc: true}
    let [column, direction] = sort.split(/\s+/)
    return {
      sortBy: column,
      sortAsc: direction ? direction.toLowerCase() !== 'desc' : true,
    }
  })

  // Initialize sortObj when sort prop changes
  $effect(() => {
    if (sort && initialSort.sortBy) {
      sortObj = {col: initialSort.sortBy, ascending: initialSort.sortAsc}
    }
  })

  const coerceId = (value: any) => {
    if (value === undefined || value === null || value === '') return undefined
    return String(value)
  }

  // Process data - combine all data processing into one $derived.by block to avoid loops
  let processedState = $derived.by(() => {
    let resultError: string | undefined = undefined
    let resultColumnSummary: any[] = []
    let resultProcessedData: any[] = []
    let resultDataTestId: string | undefined = undefined
    let resultNormalizedData: any[] = []

    try {
      // First normalize data - extract rows array from object if needed
      let inputData: any[]
      if (!Array.isArray(data)) {
        let raw = data as any
        resultDataTestId = coerceId(raw?.id)
        let candidate = raw?.rows
        inputData = Array.isArray(candidate) ? candidate : []
      } else {
        resultDataTestId = coerceId((data as any)?.id)
        inputData = data
      }

      checkInputs(inputData)
      resultColumnSummary = getColumnSummary(inputData, 'array')

      if (initialSort.sortBy) {
        let columnNames = resultColumnSummary.map((col) => col.id)
        if (!columnNames.includes(initialSort.sortBy)) {
          throw new Error(`${initialSort.sortBy} is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).`)
        }
      }

      let dateCols = resultColumnSummary
        .filter((col) => col.type === 'date' && !(inputData?.[0]?.[col.id] instanceof Date))
        .map((col) => col.id)

      let tempData = inputData
      for (let columnId of dateCols) {
        tempData = convertColumnToDate(tempData, columnId)
      }
      resultProcessedData = tempData
      resultNormalizedData = tempData

      if (link && !showLinkColBool) {
        let linkIndex = resultColumnSummary.findIndex((col) => col.id === link)
        if (linkIndex !== -1) {
          resultColumnSummary = [...resultColumnSummary.slice(0, linkIndex), ...resultColumnSummary.slice(linkIndex + 1)]
        }
      }
    } catch(thrown) {
      let message = thrown instanceof Error ? thrown.message : 'Unable to prepare dataset'
      logError(thrown, {queryId: 'DataTable'})
      resultError = message
      if (strictBuild) throw thrown
    }

    return {
      error: resultError,
      columnSummary: resultColumnSummary,
      processedData: resultProcessedData,
      dataTestId: resultDataTestId,
      normalizedData: resultNormalizedData,
    }
  })

  // Extract processed state
  let columnSummary = $derived(processedState.columnSummary)
  let normalizedData = $derived(processedState.normalizedData)
  let dataTestId = $derived(processedState.dataTestId)

  let error = $derived(processedState.error)

  // Sorting helpers
  const normalizeForSort = (value: unknown) => {
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'string') {
      let trimmed = value.trim()
      if (!trimmed) return ''
      let numeric = Number(trimmed)
      if (!Number.isNaN(numeric) && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(trimmed)) return numeric
      return trimmed.toLowerCase()
    }
    return String(value).toLowerCase()
  }

  const compareValues = (a: unknown, b: unknown, ascending: boolean) => {
    let modifier = ascending ? 1 : -1
    if (a === b) return 0
    if (a === undefined || a === null) return -1 * modifier
    if (b === undefined || b === null) return 1 * modifier
    let valA = normalizeForSort(a)
    let valB = normalizeForSort(b)
    if (valA < valB) return -1 * modifier
    if (valA > valB) return 1 * modifier
    return 0
  }

  // Compute dataForDisplay as derived to avoid effect loops
  let dataForDisplay = $derived.by(() => {
    let source = Array.isArray(normalizedData) ? normalizedData : []
    if (groupBy) {
      return source
    } else if (sortObj.col) {
      let ascending = sortObj.ascending ?? true
      return [...source].sort((a, b) => compareValues(a[sortObj.col as string], b[sortObj.col as string], ascending))
    } else {
      return source
    }
  })

  // Pagination state and derived values
  let currentPage = $state(1)
  let paginated = $derived(!groupBy && rowsNum > 0 && (dataForDisplay?.length ?? 0) > rowsNum)
  let pageCount = $derived(paginated ? Math.ceil((dataForDisplay?.length ?? 0) / rowsNum) : 1)

  // Clamp currentPage when pageCount changes - but only update if needed
  $effect(() => {
    let clamped = Math.min(Math.max(currentPage, 1), pageCount)
    if (clamped !== currentPage) {
      untrack(() => {
        currentPage = clamped
      })
    }
  })

  let displayedPageLength = $derived(paginated
    ? Math.min(rowsNum, (dataForDisplay?.length ?? 0) - rowsNum * (currentPage - 1))
    : dataForDisplay?.length ?? 0)

  const goToPage = (page: number) => {
    if (!paginated) return
    let next = Math.min(Math.max(page, 1), pageCount)
    if (Number.isFinite(next)) currentPage = next
  }

  let groupToggleStates: Record<string, boolean> = $state({})

  // Compute grouped data as derived
  let groupedData = $derived.by(() => {
    if (!groupBy || !normalizedData) return {}
    return normalizedData.reduce<Record<string, any[]>>((acc, row) => {
      let groupName = row[groupBy]
      let key = groupName ?? '(blank)'
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {})
  })

  // Initialize toggle states for new groups
  $effect(() => {
    if (groupBy && groupedData) {
      for (let name of Object.keys(groupedData)) {
        if (!(name in groupToggleStates)) {
          untrack(() => {
            groupToggleStates = {...groupToggleStates, [name]: groupsOpenBool}
          })
        }
      }
    }
  })

  const handleToggle = ({groupName}: {groupName: string}) => {
    groupToggleStates = {...groupToggleStates, [groupName]: !groupToggleStates[groupName]}
  }

  // Compute displayedRows as derived
  let displayedRows = $derived.by(() => {
    if (groupBy) {
      return normalizedData ?? []
    } else if (paginated) {
      let start = rowsNum * (currentPage - 1)
      let end = start + rowsNum
      return dataForDisplay?.slice(start, end) ?? []
    } else {
      return dataForDisplay ?? []
    }
  })

  // Sort grouped data when sortObj changes
  let sortedGroupedData = $derived.by(() => {
    if (!groupBy || !sortObj.col) return groupedData
    let ascending = sortObj.ascending ?? true
    return Object.fromEntries(
      Object.entries(groupedData).map(([name, rows]) => [
        name,
        [...rows].sort((a, b) => compareValues(a[sortObj.col as string], b[sortObj.col as string], ascending)),
      ]),
    )
  })

  const sortClick = (column: string) => () => {
    if (!sortableBool) return
    if (!column) return
    if (sortObj.col === column) {
      sortObj = {col: column, ascending: !sortObj.ascending}
    } else {
      sortObj = {col: column, ascending: true}
    }
  }

  let sortedGroupNames = $derived(groupBy
    ? Object.keys(sortedGroupedData).sort((a, b) => a.localeCompare(b))
    : [])

  let groupOffsets = $derived.by(() => {
    if (!groupBy) return {}
    let running = 0
    let offsets: Record<string, number> = {}
    for (let name of sortedGroupNames) {
      offsets[name] = running
      running += sortedGroupedData[name]?.length ?? 0
    }
    return offsets
  })

  let totalRows = $derived(dataForDisplay?.length ?? 0)
  let tableData = $derived(dataForDisplay ?? [])
</script>

{#if !error}
  {#if children}
    {@render children()}
  {:else}
    {#each columnSummary as column (column.id)}
      <Column id={column.id} />
    {/each}
  {/if}

  <div
    class={`table-container ${paginated ? 'table-container--has-pagination' : ''}`}
    data-testid={isFullPageBool ? undefined : `DataTable-${dataTestId ?? 'no-id'}`}
  >
    {#if title || subtitle}
      <div class="table-title">
        {#if title}<div class="table-title__headline">{title}</div>{/if}
        {#if subtitle}<div class="table-title__subhead">{subtitle}</div>{/if}
      </div>
    {/if}

    <div class="scrollbox pretty-scrollbar" style:background-color={$backgroundColorStore}>
      <table>
        <TableHeader
          rowNumbers={effectiveRowNumbers}
          headerColor={$headerColorStore}
          headerFontColor={$headerFontColorStore}
          {orderedColumns}
          {columnSummary}
          sortable={sortableBool}
          {sortClick}
          formatColumnTitles={formatColumnTitlesBool}
          {sortObj}
          wrapTitles={wrapTitlesBool}
          compact={compactBool}
          link={link}
        />

        {#if groupBy}
          {#each sortedGroupNames as groupName (groupName)}
            {#if groupType !== 'section'}
              <TableGroupRow
                {groupName}
                currentGroupData={sortedGroupedData[groupName]}
                toggled={groupToggleStates[groupName]}
                {columnSummary}
                rowNumbers={effectiveRowNumbers}
                rowColor={$accordionRowColorStore}
                subtotals={subtotalsBool}
                onToggle={handleToggle}
                {orderedColumns}
                compact={compactBool}
              />
            {/if}
            {#if groupType === 'section' || groupToggleStates[groupName]}
              <TableRow
                displayedData={sortedGroupedData[groupName]}
                rowShading={rowShadingBool}
                {link}
                rowNumbers={effectiveRowNumbers}
                rowLines={rowLinesBool}
                compact={compactBool}
                {columnSummary}
                grouped={true}
                {groupType}
                groupColumn={groupBy}
                groupNamePosition={groupNamePosition}
                orderedColumns={orderedColumns}
                index={groupOffsets[groupName] ?? 0}
                rowSpan={sortedGroupedData[groupName].length}
              />
              {#if subtotalsBool}
                <TableSubtotalRow
                  {groupName}
                  currentGroupData={sortedGroupedData[groupName]}
                  {columnSummary}
                  rowColor={$subtotalRowColorStore}
                  fontColor={$subtotalFontColorStore}
                  groupBy={groupBy}
                  groupType={groupType}
                  rowNumbers={effectiveRowNumbers}
                  {orderedColumns}
                  compact={compactBool}
                />
              {/if}
            {/if}
          {/each}
        {:else}
          <TableRow
            displayedData={displayedRows}
            rowShading={rowShadingBool}
            {link}
            rowNumbers={effectiveRowNumbers}
            rowLines={rowLinesBool}
            compact={compactBool}
            {columnSummary}
            grouped={false}
            {groupType}
            groupColumn={groupBy}
            groupNamePosition={groupNamePosition}
            orderedColumns={orderedColumns}
            index={rowsNum * (currentPage - 1)}
          />
        {/if}

        {#if totalRowBool && !groupBy}
          <TableTotalRow
            data={tableData}
            rowNumbers={effectiveRowNumbers}
            {columnSummary}
            rowColor={$totalRowColorStore}
            fontColor={$totalFontColorStore}
            groupType={groupType}
            {orderedColumns}
            compact={compactBool}
          />
        {/if}
      </table>
    </div>

    {#if paginated && pageCount > 1}
      <div class="pagination">
        <button class="pagination__button" disabled={currentPage === 1} onclick={() => goToPage(1)}>First</button>
        <button class="pagination__button" disabled={currentPage === 1} onclick={() => goToPage(currentPage - 1)}>Prev</button>
        <div class="pagination__status">
          Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}
        </div>
        <button class="pagination__button" disabled={currentPage === pageCount} onclick={() => goToPage(currentPage + 1)}>Next</button>
        <button class="pagination__button" disabled={currentPage === pageCount} onclick={() => goToPage(pageCount)}>Last</button>
        <div class="pagination__meta">{displayedPageLength.toLocaleString()} of {totalRows.toLocaleString()} rows</div>
      </div>
    {/if}
  </div>
{:else}
  <div style="min-height:200px;width:100%;display:grid;align-content:center;padding:8px;box-sizing:border-box">
    <ErrorDisplay error={error ?? emptyMessage ?? 'Unable to render table'} />
  </div>
{/if}

<style>
  .table-container {
    font-size: 9.5pt;
    margin: 8px 0;
    position: relative;
    color: var(--color-base-content, #1f2937);
    font-family: var(--ui-font-family, system-ui);
    line-height: 1.45;
  }

  .table-container--has-pagination {
    padding-bottom: 24px;
  }

  .table-title {
    margin-bottom: 8px;
  }

  .table-title__headline {
    font-weight: 600;
    font-size: 14px;
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
