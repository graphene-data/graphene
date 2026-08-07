<script lang="ts">
  import {untrack} from 'svelte'
  import QueryLoad from './QueryLoad.svelte'
  import Tooltip from './Tooltip.svelte'
  import {formatFromField} from '../component-utilities/format.ts'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    data: string | QueryResult
    value?: string
    title?: string
    row?: number
  }

  let {data, value = undefined, title = undefined, row = 0, ...extraProps}: Props & Record<string, unknown> = $props()
  let logger = untrack(() => componentLogger('BigValue', {data: typeof data == 'string' ? data : undefined, value}))
  untrack(() => logExtraProps(logger, 'BigValue', extraProps))

  function valueField(loaded: QueryResult) {
    return loaded?.fields?.find(field => field.name === value)
  }

  function formatValue(input: any, loaded: QueryResult) {
    if (input === null || input === undefined) return '—'
    return formatFromField(valueField(loaded), input)
  }
</script>

{#snippet bigValueContent(loaded: QueryResult)}
  {@const description = valueField(loaded)?.metadata?.description}
  {#snippet content()}
    <span class="big-value">
      {#if title}<span class="big-value__title">{title}</span>{/if}
      <span class="big-value__value">{formatValue(loaded?.rows?.[row]?.[value], loaded)}</span>
    </span>
  {/snippet}

  {#if typeof description === 'string'}
    <Tooltip text={description}>{@render content()}</Tooltip>
  {:else}
    {@render content()}
  {/if}
{/snippet}

<QueryLoad {data} fields={{value}} children={bigValueContent} componentId={logger.id} />

<style>
  .big-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }

  .big-value__title {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .big-value__value {
    font-size: 28px;
    letter-spacing: -0.02em;
    line-height: 1;
    font-family: var(--font-ui);
    font-optical-sizing: auto;
    font-weight: 600;
    color: #111;
  }
</style>
