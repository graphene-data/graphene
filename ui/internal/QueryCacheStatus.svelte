<script lang="ts">
  import {onDestroy, onMount} from 'svelte'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import {queryState, refreshQueries} from './queryEngine.ts'

  let oldestRunAt = $derived($queryState.oldestRunAt)

  // Update the age every minute
  let ageTimer: number | undefined
  let now = $state(Date.now())
  onMount(() => ageTimer = window.setInterval(() => (now = Date.now()), 60_000))
  onDestroy(() => window.clearInterval(ageTimer))

  let ago = $derived.by(() => {
    if (!oldestRunAt) return ''

    let minutes = Math.max(0, Math.floor((now - oldestRunAt) / 60_000))
    if (minutes < 5) return '' // show nothing for queries in the last 5 minutes
    if (minutes < 60) return `${minutes}m ago`

    let hours = Math.round(minutes / 60)
    if (hours >= 24 * 14) return new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'}).format(oldestRunAt)
    if (hours >= 48) return `${Math.floor(hours / 24)}d ago`

    return `${hours}h ago`
  })

  let refreshLabel = $derived.by(() => {
    let date = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(oldestRunAt)
    return `Last run ${date}\nClick to re-run`
  })

</script>

<!-- oldestRunAt will be null if queries haven't finished yet -->
{#if oldestRunAt}
  <button class="query-cache-status" type="button" aria-label={refreshLabel} title={refreshLabel} aria-live="polite" onclick={() => refreshQueries()} disabled={$queryState.loading}>
    <span>{ago}</span>
    <RefreshCw size={12} strokeWidth={1.5} aria-hidden="true" />
  </button>
{/if}

<style>
  /* Top-right counterpart to the floating menu button (top-left). */
  .query-cache-status {
    position: fixed;
    right: 10px;
    top: 10px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 28px;
    padding: 0;
    color: var(--color-tertiary);
    font-size: 12px;
    line-height: 1;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .query-cache-status:hover:not(:disabled) {
    color: var(--color-primary-strong);
  }

  .query-cache-status:disabled {
    color: var(--color-muted);
    cursor: wait;
  }

</style>
