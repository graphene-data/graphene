import {App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext} from '@modelcontextprotocol/ext-apps'
import '../../core/ui/internal/telemetry.ts'
import {setQueryFetcher} from '../../core/ui/internal/queryEngine.ts'
// import './app.css'
import {mount, unmount} from 'svelte'
// eslint-disable-next-line svelte/no-svelte-internal
import * as svelteInternal from 'svelte/internal/client'


const componentModules = import.meta.glob('../../core/ui/components/*.svelte', {eager: true}) as Record<string, {default: typeof App}>
const components = Object.fromEntries(
  Object.entries(componentModules)
    .map(([file, module]) => {
      let name = file.split('/').pop()?.replace('.svelte', '')
      return name ? [name, module.default] : null
    })
    .filter((entry): entry is [string, typeof App] => Array.isArray(entry)),
)

let graphene = window.$GRAPHENE ?? ({} as typeof window.$GRAPHENE)
graphene.components = {...(graphene.components ?? {}), ...components} as any
graphene.svelte = svelteInternal
graphene.mount = mount

const mainEl = document.querySelector('main') as HTMLElement
const app = new App({name: 'Tool Playground App', version: '1.0.0'})

function applyHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme)
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts)
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`
  }
}

app.onerror = (error) => {
  console.error(error)
}

app.ontoolinput = (input) => {
  console.log('toolInput', input)
}

let instance: any // svelte page component currently mounted

app.ontoolresult = async (result) => {
  console.log('toolResult', result)

  let code = result.structuredContent?.compiled
  if (code) {
    if (instance) unmount(instance)
    let blob = new Blob([code], {type: 'text/javascript'})
    let url = URL.createObjectURL(blob)
    try {
      let mod = await import(/* @vite-ignore */ url)
      URL.revokeObjectURL(url)
      instance = mount(mod.default, {target: mainEl})
    } catch (e) {
      console.log(e)
    }
  }
}

app.onhostcontextchanged = applyHostContext

app.onteardown = async () => {
  return {}
}

setQueryFetcher(async req => {
  console.log('sendingQuery', req)
  let res = await app.callServerTool({name: 'run-query', arguments: req})
  console.log('queryResponse', res)

  if (res.isError) throw res.structuredContent
  return res.structuredContent
})

// rollBtn.addEventListener('click', async () => {
//   let sides = Number.parseInt(sidesInput.value, 10)
//   let safeSides = Number.isFinite(sides) ? Math.max(2, sides) : 20

//   let result = await app.callServerTool({
//     name: 'roll-dice',
//     arguments: {sides: safeSides},
//   })

//   showResult(result)
//   await app.sendLog({level: 'info', data: {tool: 'roll-dice', result: result.structuredContent}})
// })

await app.connect()
const context = app.getHostContext()
if (context) applyHostContext(context)
