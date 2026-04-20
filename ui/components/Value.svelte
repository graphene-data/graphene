<script lang="ts">
    import QueryLoad from './QueryLoad.svelte'
    import {formatFromField} from '../component-utilities/format.ts'
    import type {QueryResult} from '../component-utilities/types.ts'

    interface Props {
      data: string | QueryResult
      column: string
      row?: number
    }

    let {data, column, row = 0}: Props = $props()

    function formatValue(input: any, loaded: QueryResult) {
      if (input === null || input === undefined) return '—'
      let field = loaded?.fields?.find((entry: any) => entry?.name === column)
      return formatFromField(field as any, input)
    }
</script>

{#snippet valueContent(loaded: QueryResult)}
  <span>{formatValue(loaded?.rows?.[row]?.[column], loaded)}</span>
{/snippet}

<QueryLoad {data} fields={{column}} inline children={valueContent} />
