<script lang="ts">
  import {onMount} from 'svelte'
  import {toBoolean} from '../component-utilities/inputUtils'
  import {captureInitial, getPageInputs} from '../internal/pageInputs.svelte.ts'

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

  let pageInputs = getPageInputs()
  let field = captureInitial(() => pageInputs.text(name))

  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let allowUnsafe = $derived(toBoolean(unsafe))
  let displayLabel = $derived(title || label)

  onMount(() => {
    if (!field.hasExternalValue) field.set(defaultValue ?? '')
    return () => field.destroy()
  })

  function sanitize(input: string): string {
    if (allowUnsafe) return input
    return input.replace(/'/g, "''")
  }

  function pushValue(input: string) {
    let trimmed = input ?? ''
    sanitize(trimmed)
    field.set(trimmed)
  }

  function onInput(event: Event) {
    pushValue((event.currentTarget as HTMLInputElement).value)
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
    value={field.value}
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
    font-family: var(--ui-font-family);
    font-synthesis: none;
  }
</style>
