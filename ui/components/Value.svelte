<script lang="ts">
    import {untrack} from 'svelte'
    import QueryLoad from './QueryLoad.svelte'
    import {formatFromField} from '../component-utilities/format.ts'
    import type {QueryResult} from '../component-utilities/types.ts'
    import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

    interface Props {
      data: string | QueryResult
      column: string
      row?: number
    }

    let {data, column, row = 0, ...extraProps}: Props & Record<string, unknown> = $props()
    let logger = untrack(() => componentLogger('Value', {data: typeof data == 'string' ? data : undefined, column}))
    untrack(() => logExtraProps(logger, 'Value', extraProps))

    function formatValue(input: any, loaded: QueryResult) {
      if (input === null || input === undefined) return '—'
      let field = loaded?.fields?.find((entry: any) => entry?.name === column)
      return formatFromField(field as any, input)
    }
</script>

{#snippet valueContent(loaded: QueryResult)}
  <span>{formatValue(loaded?.rows?.[row]?.[column], loaded)}</span>
{/snippet}

<QueryLoad {data} fields={{column}} inline children={valueContent} componentId={logger.id} />
