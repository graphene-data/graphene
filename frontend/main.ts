import '../../core/ui/internal/telemetry.ts'
import '../../core/ui/internal/queryEngine.ts'

import App from './App.svelte'
import * as svelteInternal from 'svelte/internal'

const componentModules = import.meta.glob('../../core/ui/components/*.svelte', {eager: true}) as Record<string, {default: typeof App}>
const components = Object.fromEntries(
  Object.entries(componentModules).map(([file, module]) => {
    let name = file.split('/').pop()?.replace('.svelte', '')
    return name ? [name, module.default] : null
  }).filter((entry): entry is [string, typeof App] => Array.isArray(entry)),
)

let graphene = window.$GRAPHENE ?? {}
graphene.components = {...(graphene.components ?? {}), ...components}
graphene.svelte = svelteInternal
window.$GRAPHENE = graphene

new App({target: document.getElementById('app')!})
