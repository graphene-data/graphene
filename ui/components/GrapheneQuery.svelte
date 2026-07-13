<script lang="ts">
  import {untrack} from 'svelte'

  interface Props {
    name: string
    code: string
  }

  let {name, code}: Props = $props()

  // Register while Svelte creates the page tree, before data-consuming components run their
  // onMount queries. This keeps query blocks order-independent without delaying query execution.
  if (typeof window !== 'undefined' && window.$GRAPHENE) {
    untrack(() => window.$GRAPHENE.registerQuery(name, code))
  }
</script>
