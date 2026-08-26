// Shared browser URL state. `route` drives app routing by pathname; `url` identifies a report view by pathname and query.
import {readable} from 'svelte/store'

const getPathname = () => window.location.pathname || '/'
const getUrl = () => getPathname() + window.location.search
const getHistoryUrl = () => getUrl() + window.location.hash

let setPathname: ((value: string) => void) | null = null
let setUrl: ((value: string) => void) | null = null

export const route = readable<string>(typeof window === 'undefined' ? '/' : getPathname(), set => {
  if (typeof window === 'undefined') return
  setPathname = set
  set(getPathname())

  let update = () => set(getPathname())
  window.addEventListener('popstate', update)
  return () => {
    window.removeEventListener('popstate', update)
    setPathname = null
  }
})

export const url = readable<string>(typeof window === 'undefined' ? '/' : getUrl(), set => {
  if (typeof window === 'undefined') return
  setUrl = set
  set(getUrl())

  let update = () => set(getUrl())
  window.addEventListener('popstate', update)
  return () => {
    window.removeEventListener('popstate', update)
    setUrl = null
  }
})

// Push same-origin navigation through the SPA; external URLs use ordinary browser navigation.
export function go(value: string) {
  if (!value) return

  let next = new URL(value, window.location.origin)
  if (next.origin !== window.location.origin) {
    window.location.assign(next.toString())
    return
  }

  let path = next.pathname + next.search + next.hash
  if (getHistoryUrl() === path) return
  window.history.pushState({}, '', path)
  publishUrl()
}

// Replace the current same-origin history entry and publish pathname/query changes to subscribers.
export function replaceState(value: string) {
  if (!value) return

  let next = new URL(value, window.location.origin)
  if (next.origin !== window.location.origin) {
    window.location.replace(next.toString())
    return
  }

  let path = next.pathname + next.search + next.hash
  if (getHistoryUrl() === path) return
  window.history.replaceState(window.history.state, '', path)
  publishUrl()
}

function publishUrl() {
  setPathname?.(getPathname())
  setUrl?.(getUrl())
}
