// Shared page load tracking for local and cloud Graphene runtimes.
// Queries report their own labels; this module owns render IDs and turns all pending work into a diagnostic-friendly list.

let graphene = window.$GRAPHENE
let nextRenderId = 0
let pendingRenders = new Set<string>()

graphene.renderStart = (id?: string | number) => {
  let renderId = id == null ? `render:${++nextRenderId}` : String(id)
  pendingRenders.add(renderId)
  return renderId
}

graphene.renderComplete = (id?: string | number) => {
  if (id == null) return
  pendingRenders.delete(String(id))
}

// Lists app, query, and render work using labels suitable for CLI and agent warnings.
function getStillLoading() {
  let loading: string[] = []
  if (graphene.appLoading) loading.push('app')

  let queries = graphene.getLoadingQueries?.()
  if (queries?.length) loading.push(...queries.map(query => `query:${query}`))
  else if (graphene.isQueryLoading?.()) loading.push('queries')

  loading.push(...pendingRenders)
  return loading
}

// Returns once work is idle and fonts and layout have settled, or reports what timed out.
graphene.waitForLoad = async (timeout = 20_000) => {
  let end = Date.now() + timeout

  while (Date.now() < end) {
    if (getStillLoading().length == 0) {
      if (document.fonts?.ready) await document.fonts.ready
      // Chrome suspends animation frames in background tabs, so only settle frames when visible.
      if (!document.hidden) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (getStillLoading().length == 0) return null
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  let stillLoading = getStillLoading()
  return stillLoading.length ? stillLoading : null
}
