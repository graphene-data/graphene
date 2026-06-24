import {readable} from 'svelte/store'

const getPathname = () => window.location.pathname || '/'

let setPathname: ((value: string) => void) | null = null

export const route = readable<string>(typeof window === 'undefined' ? '/' : getPathname(), set => {
  if (typeof window === 'undefined') return
  setPathname = set

  let update = () => set(getPathname())
  window.addEventListener('popstate', update)

  return () => {
    window.removeEventListener('popstate', update)
    setPathname = null
  }
})

export function go(url: string) {
  if (!url) return

  let next = new URL(url, window.location.origin)
  if (next.origin !== window.location.origin) {
    window.location.assign(next.toString())
    return
  }

  let path = next.pathname + next.search + next.hash
  if (window.location.pathname + window.location.search + window.location.hash === path) return

  window.history.pushState({}, '', path)
  setPathname?.(getPathname())
}
