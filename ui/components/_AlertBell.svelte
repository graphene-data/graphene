<!-- Triggered alerts show a persistent danger label; inactive alerts keep a hover-only bell. -->
<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell'
  import {getAlertStore} from '../internal/alerts.ts'
  import ActionButton from './ActionButton.svelte'
  import Tooltip from './Tooltip.svelte'

  let {componentId, singleValue = false}: {componentId: string; singleValue?: boolean} = $props()
  const alerts = getAlertStore()
</script>

{#each $alerts[componentId] || [] as alert (alert.id)}
  {@const direction = alert.above !== undefined ? 'above' : 'below'}
  {@const threshold = Number(alert.above ?? alert.below).toLocaleString('en-US')}
  {@const label = `Alert: ${direction} ${threshold} ${alert.every} → ${alert.to}`}
  {@const count = alert.triggeredKeys?.length || 0}
  <Tooltip text={label}>
    {#if count}
      <span class="triggered-alert"><Bell size={14} strokeWidth={1.8} />{singleValue ? '' : `${count} ${count === 1 ? 'value' : 'values'} `}{direction} {threshold}</span>
    {:else}
      <ActionButton type="button" aria-label={label}><Bell size={14} strokeWidth={1.8} /></ActionButton>
    {/if}
  </Tooltip>
{/each}

<style>
  .triggered-alert { display: inline-flex; align-items: center; gap: 4px; height: 1.5rem; padding: 0 5px; color: var(--color-danger); font: 600 12px/1 var(--font-ui); white-space: nowrap; }
</style>
