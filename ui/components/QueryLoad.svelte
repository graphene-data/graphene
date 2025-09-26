<script lang="ts">
  import ErrorChart from './ErrorChart.svelte'
  import {onDestroy, onMount} from 'svelte'

  export let data: string
  export let height = 200
  export let fields: string[] = []

  let error: Error | null = null
  let loaded: any[] | null = null

  let handleResults = (data) => {
    error = data.error
    loaded = data.rows
  }

  onMount(() => {
    let usedFields = fields.filter(f => !!f)
    if (usedFields.length == 0) usedFields = ['*']
    window.$GRAPHENE.query(data, usedFields, handleResults)
  })

  onDestroy(() => {
    window.$GRAPHENE.unsubscribe(handleResults)
  })

  // $: spreadProps = Object.fromEntries(
  //   Object.entries($$props).filter(([, value]) => value !== undefined)
  // )
</script>

{#if error}
  <ErrorChart title="Error" {error} />
{:else if !loaded}
  <div class='ql-skeleton' style={`height:${height}px`} role="status" aria-live="polite">
    <span class="ql-skeleton__pulse" />
  </div>
{:else if loaded.length == 0}
  <div class="empty-chart" role="note">Dataset is empty - query ran successfully, but no data was returned from the database</div>
{:else}
  <slot loaded={loaded} />
{/if}

<style>
  .ql-skeleton {
    width: 100%;
    position: relative;
    overflow: hidden;
    background: var(--chart-skeleton-bg, #f3f4f6);
    border-radius: 4px;
  }

  .ql-skeleton__pulse {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
    animation: ql-pulse 1.4s ease-in-out infinite;
    content: '';
  }

  @keyframes ql-pulse {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .empty-chart {
    width: 100%;
    padding: 12px;
    margin: 8px 0;
    border: 1px dashed rgba(107, 114, 128, 0.6);
    border-radius: 4px;
    font-size: 12px;
    color: rgba(75, 85, 99, 0.9);
    text-align: center;
    background: rgba(243, 244, 246, 0.6);
  }
</style>
