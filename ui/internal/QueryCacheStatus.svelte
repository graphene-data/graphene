<script lang="ts">
  import {onDestroy, onMount} from 'svelte'
  import {pageCacheState, refreshQueries} from './queryEngine.ts'

  let ageTimer: number | undefined
  let now = $state(Date.now())
  let cacheAge = $derived(formatCacheAge($pageCacheState.oldestCreatedAt, now))

  onMount(() => {
    ageTimer = window.setInterval(() => (now = Date.now()), 60_000)
  })

  onDestroy(() => {
    if (ageTimer) window.clearInterval(ageTimer)
  })

  function formatCacheAge(createdAt: number | undefined, currentTime: number) {
    if (!createdAt) return ''

    let minutes = Math.max(0, Math.floor((currentTime - createdAt) / 60_000))
    if (minutes < 1) return ''
    if (minutes < 60) return `${minutes}m ago`

    let hours = Math.floor(minutes / 60)
    let remainingMinutes = minutes % 60
    return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`
  }
</script>

{#if cacheAge}
  <div class="query-cache-status" aria-live="polite">
    <span>{cacheAge}</span>
    <button type="button" aria-label="Refresh cached queries" title="Refresh cached queries" onclick={() => refreshQueries()} disabled={$pageCacheState.loading}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  </div>
{/if}

<style>
  .query-cache-status {
    position: fixed;
    right: 2rem;
    top: 2rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1;
  }

  .query-cache-status button {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    color: #6b7280;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .query-cache-status button:hover:not(:disabled) {
    color: #111827;
  }

  .query-cache-status button:disabled {
    color: #9ca3af;
    cursor: wait;
  }

  .query-cache-status svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
