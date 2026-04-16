<script lang="ts">
  import Column from './Column.svelte'
  import Table from './Table.svelte'

  interface Props {
    data: any
    tableProps?: Record<string, unknown>
    columns?: Record<string, unknown>[]
    width?: number | string
  }

  let {data, tableProps = {}, columns = [], width = 880}: Props = $props()
  let wrapperWidth = typeof width === 'number' ? `${width}px` : width
</script>

<div class="table-harness" style:width={wrapperWidth}>
  {#if columns.length > 0}
    <Table data={data} {...tableProps}>
      {#each columns as column, index (index)}
        <Column {...column} />
      {/each}
    </Table>
  {:else}
    <Table data={data} {...tableProps} />
  {/if}
</div>

<style>
  .table-harness {
    max-width: 100%;
  }
</style>
