<script lang="ts">
  import {getContext, onMount, untrack} from 'svelte'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'

  interface Props {
    value: any
    valueLabel?: string
  }

  let {value, valueLabel = undefined, ...extraProps}: Props & Record<string, unknown> = $props()
  let logger = untrack(() => componentLogger('DropdownOption', {value}))
  untrack(() => logExtraProps(logger, 'DropdownOption', extraProps))

  type RegisterFn = ((option: {value: any; label: string}) => (() => void) | void) | undefined
  const register = getContext<RegisterFn>('dropdown')

  let unregister: (() => void) | void

  onMount(() => {
    if (!register) return
    unregister = register({value, label: valueLabel ?? String(value)})
    return () => {
      if (typeof unregister === 'function') unregister()
    }
  })
</script>
