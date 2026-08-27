<!-- Compact keyboard-shortcut hint for tooltips and other contextual help. -->
<script lang="ts">
  let {keys}: {keys: string[]} = $props()
  let modifier = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
  let displayKeys = $derived(keys.map(key => key === 'Mod' ? modifier : key))
</script>

<span class="shortcut" aria-label={displayKeys.join(' plus ')}>
  {#each displayKeys as key, index (`${index}-${key}`)}
    {#if index}<span aria-hidden="true">+</span>{/if}<kbd>{key}</kbd>
  {/each}
</span>

<style>
  .shortcut { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; color: #d8dee4; font-size: 11px; }
  kbd { min-width: 16px; padding: 1px 4px; border: 1px solid #57606a; border-radius: 4px; background: #32383f; box-shadow: inset 0 -1px 0 rgb(255 255 255 / 8%); color: white; font: 10px/1.4 var(--font-ui); text-align: center; }
</style>
