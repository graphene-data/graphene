<script lang="ts">
  import type {Snippet} from 'svelte'

  interface Props {
    dataType?: string
    align?: string
    height?: string | number
    width?: string | number
    wrap?: boolean
    verticalAlign?: 'top' | 'middle' | 'bottom' | string
    rowSpan?: number
    colSpan?: number
    show?: boolean
    cellColor?: string
    fontColor?: string
    topBorder?: string
    paddingLeft?: string
    borderBottom?: string
    compact?: boolean
    class?: string
    children?: Snippet
  }

  let {
    dataType = undefined, align = undefined, height = undefined, width = undefined, wrap = undefined,
    verticalAlign = 'middle', rowSpan = 1, colSpan = 1, show = true, cellColor = undefined,
    fontColor = undefined, topBorder = undefined, paddingLeft = undefined, borderBottom = undefined,
    compact = false, class: className = undefined, children,
  }: Props = $props()
</script>

<td
  role="cell"
  rowspan={rowSpan}
  colspan={colSpan}
  class={`table-cell ${dataType ?? ''} ${compact ? 'table-cell--compact' : ''} ${topBorder ?? ''} ${className ?? ''}`.trim()}
  style:text-align={align}
  style:height={height}
  style:width={width}
  style:white-space={wrap ? 'normal' : 'nowrap'}
  style:vertical-align={verticalAlign}
  style:display={show ? undefined : 'none'}
  style:background-color={cellColor}
  style:color={fontColor}
  style:padding-left={paddingLeft}
  style:border-top={topBorder}
  style:border-bottom={borderBottom}
>
  {@render children?.()}
</td>

<style>
  .table-cell {
    padding: 2px 13px 2px 6px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .table-cell:first-child {
    padding-left: 3px;
  }

  .table-cell--compact {
    padding: 1px 16.5px 1px 1px;
    font-size: 12px;
  }

  .string,
  .date,
  .boolean {
    text-align: left;
  }

  .number {
    text-align: right;
  }

  .index {
    color: var(--color-base-content-muted, #6b7280);
    text-align: left;
    max-width: min-content;
  }

  td:focus {
    outline: none;
  }
</style>
