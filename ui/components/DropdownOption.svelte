<script lang="ts">
  import {getContext, onMount} from 'svelte'
  import {DROPDOWN_CONTEXT} from '../component-utilities/dropdownContext'

  interface Props {
    value: any
    valueLabel?: string
  }

  let {value, valueLabel = undefined}: Props = $props()

  type RegisterFn = ((option: {value: any; label: string}) => (() => void) | void) | undefined
  const register = getContext<RegisterFn>(DROPDOWN_CONTEXT)

  let unregister: (() => void) | void

  onMount(() => {
    if (!register) return
    unregister = register({value, label: valueLabel ?? String(value)})
    return () => {
      if (typeof unregister === 'function') unregister()
    }
  })
</script>
