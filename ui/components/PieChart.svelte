<script lang="ts">
  import {onMount} from 'svelte'
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'
  import {logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    data: string | QueryResult
    category: string
    value: string
    title?: string
    subtitle?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    category,
    value,
    title = undefined,
    subtitle = undefined,
    height = undefined,
    width = undefined,
    ...extraProps
  }: Props & Record<string, unknown> = $props()

  onMount(() => logExtraProps('PieChart', data, extraProps))

  function buildConfig(): EChartsConfig {
    return {
      title: title ? {text: title, subtext: subtitle} : undefined,
      series: [{type: 'pie', encode: {itemName: category, value}}],
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
