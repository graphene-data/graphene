<script lang="ts">
  import {untrack} from 'svelte'
  import QueryLoad from './QueryLoad.svelte'
  import {formatFromField} from '../component-utilities/format.ts'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger} from '../internal/telemetry.ts'

  interface Props {
    data: string | QueryResult
    value?: string
    title?: string
    subtitle?: string
  }

  let {data, value = undefined, title = undefined, subtitle = undefined}: Props = $props()
  let logger = untrack(() => componentLogger('BigValue', {data: typeof data == 'string' ? data : undefined, value}))

  function formatValue(input: any, loaded: QueryResult) {
    if (input === null || input === undefined) return '—'
    let field = loaded?.fields?.find((entry: any) => entry?.name === value)
    return formatFromField(field as any, input)
  }
</script>

{#snippet bigValueContent(loaded: QueryResult)}
  <div class="big-value">
    {#if title}<div class="big-value__title">{title}</div>{/if}
    {#if subtitle}<div class="big-value__subtitle">{subtitle}</div>{/if}
    <div class="big-value__value">{formatValue(loaded?.rows?.[0]?.[value], loaded)}</div>
  </div>
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

  .big-value__subtitle {
    font-size: 13px;
    color: var(--graphene-big-value-subtitle, #4b5563);
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
