<script>
  import {onMount} from 'svelte'

  let html = ''

  window.$GRAPHENE = {
    query (sql) {
      return [{name: 'United', avg_dist: 1000}, {name: 'Delta', avg_dist: 1100}, {name: 'American', avg_dist: 1200}]
    }
  }

  onMount(() => {
    html = (window).__DOC_HTML
  })
</script>
<style>
  html, body {
    background: #18181b;
    color: #f4f4f5;
  }
</style>

<header>Graphene</header>
<main>{@html html}</main>
