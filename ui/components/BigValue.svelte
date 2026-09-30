<!-- A formatted single query value, colored red while triggered, with alert actions above the content. -->
<script lang="ts">
  import {untrack} from 'svelte'
  import AlertBell from './_AlertBell.svelte'
  import {getAlertStore} from '../internal/alerts.ts'
  import QueryLoad from './QueryLoad.svelte'
  import Tooltip from './Tooltip.svelte'
  import {formatFromField} from '../component-utilities/format.ts'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    id?: string
    data: string | QueryResult
    value: string
    title?: string
    row?: number
  }

  let {id = undefined, data, value, title = undefined, row = 0, ...extraProps}: Props & Record<string, unknown> = $props()
  let logger = untrack(() => componentLogger('BigValue', {data: typeof data == 'string' ? data : undefined, value}))
  untrack(() => logExtraProps(logger, 'BigValue', extraProps))

  const alerts = getAlertStore()
  let triggered = $derived(($alerts[id || logger.id] || []).some(alert => alert.triggeredKeys?.length))

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
      <span class="big-value__value" class:triggered>{formatValue(loaded?.rows?.[row]?.[value], loaded)}</span>
    </span>
  {/snippet}

  {#if typeof description === 'string'}
    <Tooltip text={description}>{@render content()}</Tooltip>
  {:else}
    {@render content()}
  {/if}
{/snippet}

<div class="big-value-component" data-component-id={id || logger.id}>
  <div class="component-actions"><AlertBell componentId={id || logger.id} singleValue /></div>
  <QueryLoad {data} fields={{value}} children={bigValueContent} componentId={id || logger.id} />
</div>

<style>
  .big-value-component { position: relative; }
  .component-actions { display: flex; align-items: center; justify-content: flex-end; }
  /* Preserve the value's collapsing margins when there are no alerts. */
  .component-actions:empty { display: none; }
  .big-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }

  .big-value__value.triggered { color: var(--color-danger); }

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
