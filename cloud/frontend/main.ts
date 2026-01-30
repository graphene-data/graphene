import '../../core/ui/internal/telemetry.ts'
import '../../core/ui/internal/queryEngine.ts'
import './app.css'

import App from './App.svelte'
import {mount} from 'svelte'

// eslint-disable-next-line svelte/no-svelte-internal
import * as svelteInternal from 'svelte/internal/client'

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
graphene.App = App
window.$GRAPHENE = graphene
