<script lang="ts">
  import {untrack} from 'svelte'
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    data: string | QueryResult
    category: string
    value: string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    category,
    value,
    title = undefined,
    height = undefined,
    width = undefined,
    ...extraProps
  }: Props & Record<string, unknown> = $props()

  let logger = untrack(() => componentLogger('PieChart', {data: typeof data == 'string' ? data : undefined, category, value}))
  untrack(() => logExtraProps(logger, 'PieChart', extraProps))

  function buildConfig(): EChartsConfig {
    return {
      title: title ? {text: title} : undefined,
      series: [{type: 'pie', encode: {itemName: category, value}}],
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} componentId={logger.id} />
