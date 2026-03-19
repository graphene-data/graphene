import {readable} from 'svelte/store'

const getPathname = () => {
  return window.location.pathname || '/'
}

let setPathname: ((value: string) => void) | null = null

export const route = readable<string>(getPathname(), set => {
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
  let next = url.startsWith('/') ? url : `/${url}`
  if (window.location.pathname === next) return

  window.history.pushState({}, '', next)
  setPathname?.(getPathname())
}
