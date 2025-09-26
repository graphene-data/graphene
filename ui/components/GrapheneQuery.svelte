<script>
  import {onMount} from 'svelte'

  export let name
  export let code

  onMount(() => {
    if (typeof window !== 'undefined' && window.$GRAPHENE) {
      window.$GRAPHENE.registerQuery(name, code)
    }
  })
</script>
