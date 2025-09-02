<script>
  import {onMount} from 'svelte'

  let html = ''

  window.$GRAPHENE = {
    async query (queryName) {
      if (!queryName) throw new Error('Query name is required')
      let gsql = window.__DOC_QUERIES[queryName]
      if (!gsql) throw new Error(`Query ${queryName} not found`)

      let response = await fetch('/graphene/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({queryName, gsql}),
      })
      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`)
      }
      return await response.json()
    }
  }

  onMount(() => {
    html = (window).__DOC_HTML
  })
</script>
<style>
  main {
    padding: 0 1.5rem 0 1.5rem;
  }
</style>

<main>{@html html}</main>
