window.$GRAPHENE = {
  queries: {},

  registerQuery (queryName, code) {
    this.queries[queryName] = code
  },

  async query (queryName) {
    if (!queryName) throw new Error('Query name is required')
    let gsql = this.queries[queryName]
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
  },
}

