<script lang="ts">
  import {strictBuild} from '@evidence-dev/component-utilities/chartContext'
  import ErrorChart from './ErrorChart.svelte'

  export let isInitial = true
  export let emptySet: 'pass' | 'warn' | 'error' = 'error'
  export let emptyMessage = 'No Records'
  export let chartType = 'Component'

  import {onMount} from 'svelte'

  let defaultError = chartType === 'Big Value'
    ? 'Dataset is empty'
    : 'Dataset is empty - query ran successfully, but no data was returned from the database'

  onMount(() => {
    if (emptySet === 'error' && isInitial) {
      console.error(`Error in ${chartType}: ${defaultError}`)
      if (strictBuild) throw Error(defaultError)
    } else if (emptySet === 'warn' && isInitial) {
      console.warn(`Warning in ${chartType}: Dataset is empty - query ran successfully, but no data was returned from the database`)
    }
  })
</script>

{#if ['warn', 'pass'].includes(emptySet) || !isInitial}
  <div class={`empty-chart ${chartType.toLowerCase().replace(/\s+/g, '-')}`} role="note">{emptyMessage}</div>
{:else}
  <ErrorChart title={chartType} error={defaultError} />
{/if}

<style>
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

  .empty-chart.big-value {
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-chart.value {
    text-align: left;
  }
</style>
