<script lang="ts">
  import {onDestroy, onMount} from 'svelte'
  import {queryState, refreshQueries} from './queryEngine.ts'

  let ageTimer: number | undefined
  let now = $state(Date.now())
  let cacheAge = $derived(formatCacheAge($queryState.oldestRunAt, now))

  onMount(() => {
    ageTimer = window.setInterval(() => (now = Date.now()), 60_000)
  })

  onDestroy(() => {
    if (ageTimer) window.clearInterval(ageTimer)
  })

  function formatCacheAge(runAt: number | undefined, currentTime: number) {
    if (!runAt) return ''

    let minutes = Math.max(0, Math.floor((currentTime - runAt) / 60_000))
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`

    let hours = Math.floor(minutes / 60)
    if (hours >= 24) {
      let days = Math.floor(hours / 24)
      let remainingHours = hours % 24
      return remainingHours ? `${days}d ${remainingHours}h ago` : `${days}d ago`
    }

    let remainingMinutes = minutes % 60
    return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`
  }
</script>

{#if cacheAge}
  <div class="query-cache-status" aria-live="polite">
    <span>{cacheAge}</span>
    <button type="button" aria-label="Refresh cached queries" title="Refresh cached queries" onclick={() => refreshQueries()} disabled={$queryState.loading}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  </div>
{/if}

<style>
  /* Top-right counterpart to the floating menu button (top-left). */
  .query-cache-status {
    position: fixed;
    right: 12px;
    top: 13px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--color-tertiary);
    font-size: 12px;
    line-height: 1;
  }

  .query-cache-status button {
    display: grid;
    place-items: center;
    width: 1.125rem;
    height: 1.125rem;
    padding: 0;
    color: var(--color-tertiary);
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .query-cache-status button:hover:not(:disabled) {
    color: var(--color-primary-strong);
  }

  .query-cache-status button:disabled {
    color: var(--color-muted);
    cursor: wait;
  }

  .query-cache-status svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
