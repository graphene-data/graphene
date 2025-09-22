<script lang="ts">
  export let dataType: string | undefined = undefined
  export let align: string | undefined = undefined
  export let height: string | number | undefined = undefined
  export let width: string | number | undefined = undefined
  export let wrap: boolean | undefined = undefined
  export let verticalAlign: 'top' | 'middle' | 'bottom' | string = 'middle'
  export let rowSpan = 1
  export let colSpan = 1
  export let show = true
  export let cellColor: string | undefined = undefined
  export let fontColor: string | undefined = undefined
  export let topBorder: string | undefined = undefined
  export let paddingLeft: string | undefined = undefined
  export let borderBottom: string | undefined = undefined
  export let compact = false
</script>

<td
  role="cell"
  rowspan={rowSpan}
  colspan={colSpan}
  class={`table-cell ${dataType ?? ''} ${compact ? 'table-cell--compact' : ''} ${topBorder ?? ''} ${$$restProps.class ?? ''}`.trim()}
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
  <slot />
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
