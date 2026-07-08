<script lang="ts">
  import {untrack} from 'svelte'
  import {toBoolean} from '../component-utilities/inputUtils.ts'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    name: string
    title?: string
    label?: string
    description?: string
    placeholder?: string
    defaultValue?: string
    hideDuringPrint?: boolean | string
  }

  let {name, title, label, description, placeholder = 'Type to search', defaultValue, hideDuringPrint = true, ...extraProps}: Props & Record<string, unknown> = $props()

  let logger = untrack(() => componentLogger('TextInput', {name}))
  untrack(() => logExtraProps(logger, 'TextInput', extraProps))

  let value = $state('')

  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let displayLabel = $derived(title || label)

  $effect(() => {
    let unsub = window.$GRAPHENE.param(name, 'scalar', defaultValue ?? null, next => {
      value = Array.isArray(next) ? String(next[0] ?? '') : String(next ?? '')
    })
    return unsub
  })

  function onInput(event: Event) {
    let next = (event.currentTarget as HTMLInputElement).value
    window.$GRAPHENE.updateParam(name, next === '' ? null : next)
  }
</script>

<div class={`input-block${hidePrint ? ' hide-print' : ''}`}>
  {#if displayLabel}
    <label class="input-label" for={`text-input-${name}`}>{displayLabel}</label>
  {/if}
  {#if description}
    <div class="input-description">{description}</div>
  {/if}
  <input
    id={`text-input-${name}`}
    class="text-input"
    type="text"
    value={value}
    placeholder={placeholder}
    oninput={onInput}
  />
</div>

<style>
  .input-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
  }
  @media print {
    .hide-print {
      display: none !important;
    }
  }
  .input-label {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 600;
    color: var(--input-label-color, #374151);
  }
  .input-description {
    font-size: 12px;
    color: rgba(55, 65, 81, 0.8);
  }
  .text-input {
    min-width: 200px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(107, 114, 128, 0.4);
    font-size: 14px;
    font-family: var(--font-ui);
    font-synthesis: none;
  }
</style>
