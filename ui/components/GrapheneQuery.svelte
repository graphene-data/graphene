<script lang="ts">
  import {onMount} from 'svelte'

  interface Props {
    name: string
    code: string
  }

  let {name, code}: Props = $props()

  onMount(() => {
    if (typeof window !== 'undefined' && window.$GRAPHENE) {
      window.$GRAPHENE.registerQuery(name, code)
    }
  })
</script>
