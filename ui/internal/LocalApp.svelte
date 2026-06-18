<script lang="ts">
  import {onDestroy, onMount} from 'svelte'
  import {setErrorFor} from './telemetry.ts'
  import {PageInputs, activatePageInputs, releasePageInputs, setPageInputsContext} from './pageInputs.svelte.ts'
  import {createParentFrameRuntime, type ParentFrameRuntime} from './frameRuntime.ts'
  import navFiles from 'virtual:nav'
  import Sidebar from './Sidebar.svelte'
  import SidebarToggle from './SidebarToggle.svelte'
  import PageNavGroup from './PageNavGroup.svelte'
  import ErrorDisplay from './ErrorDisplay.svelte'
  import ChartGallery from './ChartGallery.svelte'
  import StyleGallery from './StyleGallery.svelte'
  import QueryCacheStatus from './QueryCacheStatus.svelte'
  import {type GrapheneError} from '../../lang/index.js'

  let pageInputs = activatePageInputs(new PageInputs())
  setPageInputsContext(pageInputs)
  onDestroy(() => releasePageInputs(pageInputs))

  // Nav sidebar with HMR support for the virtual file list
  let navData = $state(navFiles)
  import.meta.hot?.accept('virtual:nav', mod => navData = mod.default)

  let pathName = window.location.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index'
  // Mirror the server-side folder redirect: if /foo.md doesn't exist but /foo/index.md does, load that.
  if (pathName != 'index' && !navFiles.some(f => f.path == pathName + '.md') && navFiles.some(f => f.path == pathName + '/index.md')) {
    pathName += '/index'
  }

  let compileError = $state<GrapheneError | null>(null)
  let pageMeta = $state<any>({})
  let frameEl = $state<HTMLIFrameElement | null>(null)
  let frameRuntime: ParentFrameRuntime | null = null
  let frameSrc = $derived(`/_graphene/frame/${pathName}?parentOrigin=${encodeURIComponent(window.location.origin)}`)

  let InternalPage = $state<any>(null)

  $effect(() => {
    if (!frameEl || pathName == '_charts' || pathName == '_styles') return
    frameRuntime?.destroy()
    frameRuntime = createParentFrameRuntime({
      frame: frameEl,
      pageInputs,
      getCompileError: () => compileError,
      onMeta: payload => pageMeta = payload || {},
      onError: payload => {
        compileError = payload
        setErrorFor('compile', compileError)
      },
      onReady: () => {
        window.$GRAPHENE.appLoading = false
      },
      hooks: runtime => ({
        listComponentIds: () => runtime.requestFrame('components.list'),
        exportChartCsv: (chart: string) => runtime.requestFrame('exports.csv', {chart}),
        captureComponent: (component: string) => compileError ? undefined : runtime.requestFrame('components.screenshot', {component}),
        capturePage: () => compileError ? undefined : runtime.requestFrame('page.screenshot'),
      }),
    })
  })

  onDestroy(() => {
    frameRuntime?.destroy()
  })

  onMount(() => {
    if (pathName == '_charts') InternalPage = ChartGallery
    else if (pathName == '_styles') InternalPage = StyleGallery
    if (InternalPage) window.$GRAPHENE.appLoading = false
  })
</script>

<SidebarToggle style='position:fixed;top:2rem;left:2rem;opacity:0.3;' />
<Sidebar>
  <PageNavGroup files={navData} />
</Sidebar>
<QueryCacheStatus />

<main id="content" class={{pageContent: compileError || !!InternalPage, frameContent: !InternalPage, dashboardLayout: pageMeta.layout == 'dashboard'}}>
  {#if InternalPage}
    <InternalPage />
  {:else if compileError}
    <h1 class="page-error-heading">Error loading page</h1>
    <ErrorDisplay error={compileError} />
  {:else}
    <iframe title="Graphene page" bind:this={frameEl} src={frameSrc} sandbox="allow-scripts allow-downloads"></iframe>
  {/if}
</main>

<style>
  main.frameContent {
    margin: 0;
    padding: 0;
    max-width: none;
  }

  iframe {
    display: block;
    width: 100%;
    height: 100vh;
    border: 0;
    background: white;
  }

  .page-error-heading { margin-top: 12px; }
</style>
