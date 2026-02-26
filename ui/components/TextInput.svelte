<script lang="ts">
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    name: string
    title?: string
    label?: string
    description?: string
    placeholder?: string
    defaultValue?: string
    hideDuringPrint?: boolean | string
    unsafe?: boolean | string
  }

  let {
    name, title = undefined, label = undefined, description = undefined,
    placeholder = 'Type to search', defaultValue = undefined, hideDuringPrint = true, unsafe = false,
  }: Props = $props()

  // svelte-ignore state_referenced_locally - intentionally capturing initial value only
  let value = $state(defaultValue ?? '')

  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let allowUnsafe = $derived(toBoolean(unsafe))
  let displayLabel = $derived(title || label)

  // Push value changes to parent
  $effect(() => {
    pushValue(value)
  })

  function sanitize (input: string): string {
    if (allowUnsafe) return input
    return input.replace(/'/g, "''")
  }

  function pushValue (input: string) {
    let trimmed = input ?? ''
    let _safe = sanitize(trimmed)
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
