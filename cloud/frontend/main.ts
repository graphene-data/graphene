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
window.$GRAPHENE = graphene

// Lazy load App only when needed (avoids Stytch initialization for dynamic renders)
export async function mountApp (target: HTMLElement) {
  let {default: App} = await import('./App.svelte')
  mount(App, {target})
}
