<!-- Declares a scalar URL/query parameter without rendering a control on the page. -->
<script lang="ts">
  import {untrack} from 'svelte'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    name: string
    defaultValue?: string
  }

  let {name, defaultValue, ...extraProps}: Props & Record<string, unknown> = $props()

  let logger = untrack(() => componentLogger('Hidden', {name}))
  untrack(() => logExtraProps(logger, 'Hidden', extraProps))

  $effect(() => window.$GRAPHENE.param(name, 'scalar', defaultValue ?? null, () => undefined))
</script>
