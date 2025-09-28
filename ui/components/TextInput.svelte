<script lang="ts">
  import {onMount} from 'svelte'
  import {toBoolean} from './inputUtils'

  export let name: string
  export let title: string | undefined = undefined
  export let label: string | undefined = undefined
  export let description: string | undefined = undefined
  export let placeholder: string = 'Type to search'
  export let defaultValue: string | undefined = undefined
  export let hideDuringPrint: boolean | string = true
  export let unsafe: boolean | string = false

  let value = defaultValue || ''

  $: hidePrint = toBoolean(hideDuringPrint)
  $: allowUnsafe = toBoolean(unsafe)
  $: displayLabel = title || label

  onMount(() => {
    pushValue(value)
  })

  $: if (defaultValue !== undefined && defaultValue !== value && !value) {
    value = defaultValue
    pushValue(value)
  }

  function sanitize (input: string): string {
    if (allowUnsafe) return input
    return input.replace(/'/g, "''")
  }

  function pushValue (input: string) {
    let trimmed = input ?? ''
    let safe = sanitize(trimmed)
    let sqlLiteral = safe ? `'${safe}'` : 'NULL'
    let paramValue = trimmed === '' ? null : trimmed
    window.$GRAPHENE.updateParam(name, paramValue)
  }

  function onInput (event: Event) {
    value = (event.currentTarget as HTMLInputElement).value
    pushValue(value)
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
    on:input={onInput}
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
  }
</style>
