<script lang="ts">
  import {getContext, onDestroy, onMount} from 'svelte'
  import {DROPDOWN_CONTEXT} from './dropdownContext'

  export let value: any
  export let valueLabel: string | undefined = undefined

  type RegisterFn = ((option: {value: any; label: string}) => (() => void) | void) | undefined
  const register = getContext<RegisterFn>(DROPDOWN_CONTEXT)

  let unregister: (() => void) | void

  onMount(() => {
    if (!register) return
    unregister = register({value, label: valueLabel ?? String(value)})
  })

  onDestroy(() => {
    if (typeof unregister === 'function') unregister()
  })
</script>
