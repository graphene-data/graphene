import {App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext} from '@modelcontextprotocol/ext-apps'
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js'

const mainEl = document.querySelector('.main') as HTMLElement
const sidesInput = document.getElementById('sides-input') as HTMLInputElement
const rollBtn = document.getElementById('roll-btn') as HTMLButtonElement
const latestResult = document.getElementById('latest-result') as HTMLElement

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

function showResult(result: CallToolResult) {
  latestResult.textContent = JSON.stringify(result.structuredContent ?? result.content, null, 2)
}

app.onerror = (error) => {
  console.error(error)
}

app.ontoolinput = (input) => {
  console.log('toolInput', input)
}

app.ontoolresult = (result) => {
  showResult(result)
}

app.onhostcontextchanged = applyHostContext

app.onteardown = async () => {
  return {}
}

rollBtn.addEventListener('click', async () => {
  let sides = Number.parseInt(sidesInput.value, 10)
  let safeSides = Number.isFinite(sides) ? Math.max(2, sides) : 20

  let result = await app.callServerTool({
    name: 'roll-dice',
    arguments: {sides: safeSides},
  })

  showResult(result)
  await app.sendLog({level: 'info', data: {tool: 'roll-dice', result: result.structuredContent}})
})

await app.connect()
const context = app.getHostContext()
if (context) applyHostContext(context)
