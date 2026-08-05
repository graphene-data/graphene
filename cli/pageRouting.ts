// Converts project-relative Markdown paths into their browser routes. File paths retain the optional pages/ prefix; routes never expose it.

// Map a Markdown file path to its canonical URL route, including index-page collapsing and query parameters.
export function routeForPage(path: string, pagesPrefix: string, params: Record<string, string | string[]> = {}) {
  let route = path.replace(/\\/g, '/').replace(/^\//, '')
  if (route.startsWith(pagesPrefix)) route = route.slice(pagesPrefix.length)
  route = '/' + route.replace(/\.md$/, '').replace(/(^|\/)index$/, '')

  let search = new URLSearchParams()
  Object.entries(params).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => search.append(name, item))
    else search.append(name, value)
  })
  return route + (search.size ? `?${search}` : '')
}
