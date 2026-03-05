// Core runtime setup - no auth dependencies
// This file can be imported by dynamic renders without triggering Stytch initialization

import '../../core/ui/internal/telemetry.ts'
import '../../core/ui/internal/queryEngine.ts'
import './app.css'

import {mount} from 'svelte'

// eslint-disable-next-line svelte/no-svelte-internal
import * as svelteInternal from 'svelte/internal/client'

import type App from './App.svelte'
const componentModules = import.meta.glob('../../core/ui/components/*.svelte', {eager: true}) as Record<string, {default: typeof App}>
const components = Object.fromEntries(
  Object.entries(componentModules).map(([file, module]) => {
    let name = file.split('/').pop()?.replace('.svelte', '')
    return name ? [name, module.default] : null
  }).filter((entry): entry is [string, typeof App] => Array.isArray(entry)),
)

let graphene = window.$GRAPHENE ?? {} as typeof window.$GRAPHENE
graphene.components = {...(graphene.components ?? {}), ...components} as any
graphene.svelte = svelteInternal
graphene.mount = mount

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

graphene.waitForLoad = async (timeout = 20_000) => {
  let end = Date.now() + timeout
  let idleStart = 0

  // Let newly mounted components enqueue their first query/render work.
  await new Promise(resolve => setTimeout(resolve, 150))

  while (Date.now() < end) {
    let isQueryLoading = typeof graphene.isQueryLoading === 'function' ? !!graphene.isQueryLoading() : false
    let isBusy = isQueryLoading || pendingRenders.size > 0
    if (isBusy) idleStart = 0
    else {
      if (!idleStart) idleStart = Date.now()
      if (Date.now() - idleStart >= 200) return true
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return false
}

window.$GRAPHENE = graphene

// Lazy load App only when needed (avoids Stytch initialization for dynamic renders)
export async function mountApp(target: HTMLElement) {
  let {default: App} = await import('./App.svelte')
  mount(App, {target})
}
