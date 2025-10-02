<script lang="ts">
  import chroma from 'chroma-js'
  import InlineDelta from './InlineDelta.svelte'
  import TableCell from './TableCell.svelte'
  import {safeExtractColumn} from '../component-utilities/tableUtils'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {getThemeStores} from '../component-utilities/themeStores'

  export let displayedData: any[] = []
  export let rowShading: boolean | string | undefined = undefined
  export let link: string | undefined = undefined
  export let rowNumbers: boolean | string | undefined = undefined
  export let rowLines: boolean | string | undefined = undefined
  export let index = 0
  export let columnSummary: any[] = []
  export let grouped = false
  export let groupType: 'accordion' | 'section' | undefined = undefined
  export let groupColumn: string | undefined = undefined
  export let rowSpan = 1
  export let groupNamePosition: 'top' | 'middle' | 'bottom' = 'middle'
  export let orderedColumns: any[] = []
  export let compact: boolean | string | undefined = undefined

  const {theme} = getThemeStores()

  const computeColorScale = (
    column: any,
    columnMin: number | undefined,
    columnMax: number | undefined,
  ) => {
    if (!column?.colorScale || !column?.colorScale.length) return undefined
    if (!hasFiniteNumber(columnMin) || !hasFiniteNumber(columnMax) || columnMin === columnMax) return undefined

    let rawDomain
    if (Array.isArray(column.colorBreakpoints) && column.colorBreakpoints.length) {
      rawDomain = column.colorBreakpoints
    } else if (column.colorMid !== undefined && column.colorMid !== null) {
      rawDomain = [columnMin, column.colorMid, columnMax]
    } else {
      rawDomain = [columnMin, columnMax]
    }

    let domain = rawDomain
      .map((value) => (typeof value === 'string' ? Number(value) : value))
      .filter((value) => typeof value === 'number' && Number.isFinite(value))

    if (domain.length < 2) return undefined

    try {
      return chroma.scale(column.colorScale).domain(domain)
    } catch (error) {
      console.warn('Unable to build color scale for column', column.id, error)
      return undefined
    }
  }

  const hasFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

  const toBool = (val: boolean | string | undefined) => {
    if (val === undefined) return false
    if (typeof val === 'string') {
      let normalized = val.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return Boolean(val)
  }

  rowShading = toBool(rowShading)
  rowNumbers = toBool(rowNumbers)
  rowLines = toBool(rowLines ?? true)
  compact = toBool(compact)

  const isExternalUrl = (url: string) => {
    try {
      let target = new URL(url, window.location.origin)
      return target.origin !== window.location.origin
    } catch {
      return false
    }
  }

  const navigateToLink = (row: any, event: MouseEvent) => {
    if (!link) return
    let href = row?.[link]
    if (!href) return

    let anchorTarget = (event.target as HTMLElement | null)?.closest('a')
    if (anchorTarget && anchorTarget.getAttribute('target') === '_blank') return

    if (isExternalUrl(href)) {
      window.open(href, '_blank', 'noopener')
      return
    }

    window.location.assign(href)
  }
</script>

{#each displayedData as row, i (i)}
  {@const shaded = rowShading && i % 2 === 1}
  {@const clickable = link && row[link]}
  <tr
    class="table-row"
    class:table-row--shaded={shaded}
    class:table-row--lined={rowLines}
    class:table-row--clickable={clickable}
    on:click={(event) => clickable && navigateToLink(row, event)}
  >
    {#if rowNumbers && groupType !== 'section'}
      <TableCell class="index" {compact}>
        {(index + i + 1).toLocaleString()}
      </TableCell>
    {/if}

    {#each orderedColumns as column, k (k)}
      {@const summary = safeExtractColumn(column, columnSummary)}
      {@const scaleSummary = column.scaleColumn ? columnSummary.find((d) => d.id === column.scaleColumn) : summary}
      {@const columnMin = column.colorMin ?? scaleSummary?.columnUnitSummary?.min}
      {@const columnMax = column.colorMax ?? scaleSummary?.columnUnitSummary?.max}
      {@const colorScale = column.contentType === 'colorscale'
        ? computeColorScale(column, columnMin, columnMax)
        : undefined}
      {@const rawCellColor = (() => {
        if (!colorScale) return undefined
        if (column.scaleColumn) return colorScale(row[column.scaleColumn])
        return colorScale(row[column.id])
      })()}
      {@const formattedColor = rawCellColor ? chroma(rawCellColor).hex() : undefined}
      {@const fontColor = (() => {
        if (column.redNegatives && row[column.id] < 0) return $theme.colors.negative
        if (!formattedColor) return undefined
        let contentContrast = chroma.contrast(formattedColor, $theme.colors['base-content'])
        let backgroundContrast = chroma.contrast(formattedColor, $theme.colors['base-100']) + 0.5
        if (contentContrast < backgroundContrast) return $theme.colors['base-100']
        return $theme.colors['base-content']
      })()}
      {@const columnFormat = (() => {
        if (column.fmt) return getFormatObjectFromString(column.fmt, summary.format?.valueType)
        if (column.fmtColumn && row[column.fmtColumn]) {
          return getFormatObjectFromString(row[column.fmtColumn], summary.format?.valueType)
        }
        return summary.format
      })()}
      {@const paddingLeft = k === 0 && grouped && groupType === 'accordion' && !rowNumbers ? '28px' : undefined}
      {@const shouldShow = !(groupType === 'section' && groupColumn === summary.id && i !== 0)}
      <TableCell
        class={summary?.type}
        {compact}
        verticalAlign={groupType === 'section' ? groupNamePosition : undefined}
        rowSpan={groupType === 'section' && groupColumn === summary.id && i === 0 ? rowSpan : 1}
        {paddingLeft}
        wrap={column.wrap}
        cellColor={formattedColor}
        fontColor={fontColor}
        show={shouldShow}
      >
        {#if column.contentType === 'image' && row[column.id] !== undefined}
          <img
            src={row[column.id]}
            alt={column.alt ? row[column.alt] : String(row[column.id]).replace(/^(.*[/])/, '').replace(/[.][^.]+$/, '')}
            class="table-image"
            style:height={column.height}
            style:width={column.width}
          />
        {:else if column.contentType === 'link' && row[column.id] !== undefined}
          {#if column.linkLabel != undefined && row[column.linkLabel] == undefined && column.linkLabel in row}
            –
          {:else}
            {@const linkTarget = row[column.id]}
            <a
              href={linkTarget}
              target={column.openInNewTab ? '_blank' : undefined}
              class="table-link"
            >
              {#if column.linkLabel != undefined}
                {#if row[column.linkLabel] != undefined}
                  {@const labelSummary = safeExtractColumn({id: column.linkLabel}, columnSummary)}
                  {formatValue(
                    row[column.linkLabel],
                    column.fmt ? getFormatObjectFromString(column.fmt, labelSummary.format?.valueType) : labelSummary.format,
                    labelSummary.columnUnitSummary,
                  )}
                {:else}
                  {column.linkLabel}
                {/if}
              {:else}
                {formatValue(
                  row[column.id],
                  column.fmt ? getFormatObjectFromString(column.fmt, summary.format?.valueType) : summary.format,
                  summary.columnUnitSummary,
                )}
              {/if}
            </a>
          {/if}
        {:else if column.contentType === 'delta' && row[column.id] !== undefined}
          <InlineDelta
            value={row[column.id]}
            downIsGood={column.downIsGood}
            formatObject={columnFormat}
            columnUnitSummary={summary.columnUnitSummary}
            showValue={column.showValue}
            showSymbol={column.deltaSymbol}
            align={column.align}
            neutralMin={column.neutralMin ?? 0}
            neutralMax={column.neutralMax ?? 0}
            chip={column.chip}
          />
        {:else}
          {#if row[column.id] === null || row[column.id] === undefined}
            –
          {:else if summary.type === 'number'}
            {formatValue(row[column.id], columnFormat, summary.columnUnitSummary)}
          {:else}
            {formatValue(row[column.id], columnFormat, summary.columnUnitSummary)}
          {/if}
        {/if}
      </TableCell>
    {/each}

    {#if link}
      <TableCell class="table-row__chevron" show={Boolean(row[link])} align="center">
        {#if row[link]}
          <svg class="table-row__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z"
              fill="currentColor"
              fill-rule="evenodd"
            />
          </svg>
        {/if}
      </TableCell>
    {/if}
  </tr>
{/each}

<style>
  .table-row {
    transition: background-color 0.15s ease-in-out;
  }

  .table-row--shaded {
    background: rgba(229, 231, 235, 0.4);
  }

  .table-row--clickable {
    cursor: pointer;
  }

  .table-row--clickable:hover {
    background: rgba(229, 231, 235, 0.6);
  }

  :global(.table-row--lined) td {
    border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  }

  .table-image {
    display: block;
    margin: 4px auto;
    max-width: 100%;
    border-radius: 0;
  }

  .table-link {
    color: var(--color-primary, #2563eb);
    text-decoration: none;
  }

  .table-link:hover {
    filter: brightness(1.1);
  }

  :global(.table-row__chevron) {
    width: 24px;
    padding-right: 6px;
  }

  .table-row__icon {
    width: 10px;
    height: 10px;
  }
</style>
