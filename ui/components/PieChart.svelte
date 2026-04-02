<script lang="ts">
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig} from '../component-utilities/types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
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
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    return {
      title: title ? {text: title, subtext: subtitle} : undefined,
      tooltip: {trigger: 'item', formatter: '{b}: {c} ({d}%)'},
      series: [{type: 'pie', encode: {itemName: category, value}, radius: ['40%', '70%']}],
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
