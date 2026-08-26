<!-- Shared visual primitive for compact controls rendered in a report component's action area. -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLButtonAttributes} from 'svelte/elements'

  type Props = HTMLButtonAttributes & {active?: boolean; children: Snippet}
  let {active = false, children, ...buttonProps}: Props = $props()
</script>

<button class:active {...buttonProps}>
  {@render children()}
</button>

<style>
  button { display: flex; align-items: center; justify-content: center; gap: 2px; min-width: 1.5rem; height: 1.5rem; padding: 0 5px; border: 0; border-radius: 6px; color: var(--color-muted); background: transparent; font: 600 10px/1 var(--font-ui); cursor: pointer; opacity: 0; transition: opacity 120ms ease, color 120ms ease, background 120ms ease; }
  :global(body.standalone) button { display: none; }
  :global([data-component-id]:hover) button, button:focus-visible, button.active { opacity: 1; }
  button:hover, button:focus-visible { color: var(--color-tertiary); background: var(--color-hover); }
  button.active { color: var(--color-tertiary); background: var(--color-surface); }
  button:focus-visible { outline: 2px solid var(--color-primary-strong); outline-offset: 2px; }
  button :global(svg) { width: .875rem; height: .875rem; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
