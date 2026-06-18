<script lang="ts">
  import {onDestroy, onMount, tick} from 'svelte'
  import {rowsToCsv} from '../../lang/csv.ts'
  import {type GrapheneError} from '../../lang/index.js'
  import {GrapheneFrameChild} from './frameBridge.ts'
  import {setErrorFor} from './telemetry.ts'
  import {setPageInputsContext} from './pageInputs.svelte.ts'
  import {createChildFrameRuntime} from './frameRuntime.ts'
  import ErrorDisplay from './ErrorDisplay.svelte'

  let search = new URLSearchParams(window.location.search)
  let parentOrigin = search.get('parentOrigin') || window.location.origin
  let bridge = new GrapheneFrameChild(parentOrigin)

  let childRuntime = createChildFrameRuntime({
    bridge,
    waitForLoad: timeout => window.$GRAPHENE.waitForLoad(timeout),
    handlers: {
      'components.list': () => listComponentIds(),
      'exports.csv': payload => exportChartCsv(payload?.chart || ''),
      'components.screenshot': payload => captureComponent(payload?.component || ''),
      'page.screenshot': () => takeScreenshot(),
    },
  })
  let pageInputs = childRuntime.pageInputs
  setPageInputsContext(pageInputs)
  onDestroy(() => childRuntime.destroy())

  let pathName = window.location.pathname.replace(/^\/_graphene\/frame\/?/, '').replace(/\/$/, '') || 'index'

  let compileError = $state<GrapheneError | null>(null)
  let Page = $state<any>(null)
  let pageMeta = $state<any>({})

  import.meta.hot?.on('vite:error', payload => {
    if (!isCurrentPageError(payload.err)) return
    reportCompileError(payload.err)
    window.$GRAPHENE.appLoading = false
    bridge.notify('render.ready')
  })

  onMount(async () => {
    try {
      document.fonts.load("12px 'Source Sans 3'")
      await document.fonts.ready

      let params = await bridge.request('params.get')
      pageInputs.applyExternalParams(params || {})

      let mod = await import(/* @vite-ignore */ '/' + pathName + '.md')
      Page = mod.default
      pageMeta = mod.metadata || {}
      compileError = null
      setErrorFor('compile', null)
      bridge.notify('page.error', null)
      bridge.notify('page.meta', pageMeta)
    } catch (error: any) {
      if (isFailedDynamicImport(error)) {
        await new Promise(resolve => setTimeout(resolve, 50))
        if (compileError) return
      }
      reportCompileError(error)
    } finally {
      await tick()
      window.$GRAPHENE.appLoading = false
      bridge.notify('render.ready')
    }
  })

  function reportCompileError(error: any) {
    compileError = toGrapheneError(error)
    Page = null
    setErrorFor('compile', compileError)
    bridge.notify('page.error', compileError)
  }

  function isCurrentPageError(error: any) {
    let path = String(error?.id || '').split('?')[0].replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
    return path.endsWith(pathName + '.md')
  }

  function isFailedDynamicImport(error: any) {
    return String(error?.message || error).includes('Failed to fetch dynamically imported module')
  }

  function toGrapheneError(error: any): GrapheneError {
    let line = Math.max(0, (error?.loc?.line || 1) - 1)
    let col = Math.max(0, error?.loc?.column || 0)
    return {
      message: String(error?.message || error).replace(/^.*?:\d+:\d+\s*/, '').replace(/\s*https:\/\/svelte\.dev\/\S+/g, '').trim(),
      frame: error?.frame,
      file: String(error?.id || '').split('?')[0].replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/^\/+/, ''),
      from: {line, col, offset: 0},
      to: {line, col: col + 1, offset: 0},
    }
  }

  let html2canvas: any
  async function loadHtml2Canvas() {
    html2canvas ||= (await import('@graphenedata/html2canvas'))?.default
  }

  async function captureComponent(component: string) {
    let componentEl = findVisualComponentElement(component)
    if (!componentEl) return undefined

    await loadHtml2Canvas()
    let canvas = await html2canvas(componentEl, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
    return canvas?.toDataURL('image/png')
  }

  async function takeScreenshot() {
    await loadHtml2Canvas()
    let canvas = await html2canvas(document.body, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
    return canvas?.toDataURL('image/png')
  }

  function exportChartCsv(chart: string) {
    let componentEl = findVisualComponentElement(chart)
    let componentId = componentEl?.getAttribute('data-component-id') || ''
    let data = componentId ? window.$GRAPHENE.chartExports?.[componentId] : undefined
    if (!data) return undefined
    return rowsToCsv(data.rows || [], data.fields || [])
  }

  function findVisualComponentElement(component: string) {
    let escaped = window.CSS.escape(component)
    let componentEl = document.querySelector(`[data-chart-title="${escaped}"]`) as HTMLElement | null
    componentEl ||= document.querySelector(`[data-component-title="${escaped}"]`) as HTMLElement | null
    componentEl ||= document.querySelector(`[data-component-id="${escaped}"]`) as HTMLElement | null
    return componentEl
  }

  function listComponentIds() {
    return Array.from(document.querySelectorAll('[data-component-id]'))
      .map(el => el.getAttribute('data-component-id') || '')
      .filter(componentId => componentId.trim().length > 0)
  }
</script>

<main id="content" class={{pageContent: compileError || !!Page, dashboardLayout: pageMeta.layout == 'dashboard'}}>
  {#if compileError}
    <h1 class="page-error-heading">Error loading page</h1>
    <ErrorDisplay error={compileError} />
  {:else if Page}
    {#if pageMeta.title}
      <h1 class="page-title">{pageMeta.title}</h1>
    {/if}
    <Page />
  {/if}
</main>

<style>
  .page-error-heading { margin-top: 12px; }
</style>
