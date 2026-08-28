<script lang="ts">
  import {onMount, tick} from 'svelte'
  import {setErrorFor} from './telemetry.ts'
  import navFiles, {projectName} from 'virtual:nav'
  import Sidebar from './Sidebar.svelte'
  import SidebarToggle from './SidebarToggle.svelte'
  import PageNavGroup from './PageNavGroup.svelte'
  import ErrorDisplay from './ErrorDisplay.svelte'
  import EmptyPage from './EmptyPage.svelte'
  import ChartGallery from './ChartGallery.svelte'
  import StyleGallery from './StyleGallery.svelte'
  import QueryCacheStatus from './QueryCacheStatus.svelte'
  import {type GrapheneError} from '../../lang/index.js'
  import {prettyPrintFilename} from './utils.ts'

  // Nav sidebar with HMR support for the virtual file list.
  let navData = $state(navFiles)
  import.meta.hot?.accept('virtual:nav', mod => navData = mod.default)

  let currentRoute = window.location.pathname.replace(/\/+$/, '') || '/'
  let pathName = currentRoute.replace(/^\//, '') || 'index'
  let isRoot = currentRoute == '/'

  // Each nav entry maps a browser route to its Markdown source file. This matters because routes
  // omit details such as the pages/ folder and index.md. Use that mapping to find the module to
  // import; no matching entry means the route is missing rather than the page failing to compile.
  let activePage = $derived(navData.find(page => page.route == currentRoute))
  let pageExists = $derived(!!activePage)
  let navPages = $derived(navData.map(page => ({route: page.route, title: page.title, hideInNav: page.hideInNav})))

  // Track compile errors from both initial load and subsequent HMR failures.
  let compileError = $state<GrapheneError | null>(null)
  import.meta.hot?.on('vite:error', (payload) => {
    let path = String(payload.err.id || '').split('?')[0].replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!activePage || !path.endsWith(activePage.path)) return // ignore errors on md pages that are not this page

    let line = Math.max(0, (payload.err.loc?.line || 1) - 1)
    let col = Math.max(0, payload.err.loc?.column || 0)
    compileError = {
      message: String(payload.err.message || '').replace(/^.*?:\d+:\d+\s*/, '').replace(/\s*https:\/\/svelte\.dev\/\S+/g, '').trim(),
      frame: payload.err.frame,
      file: path,
      from: {line, col, offset: 0},
      to: {line, col: col + 1, offset: 0},
    }
    setErrorFor('compile', compileError)
    Page = null
  })

  // The md file is dynamically imported, so even if there's a compile error, we'll still load LocalApp and can show the user the issue
  let Page = $state<any>(null)
  let pageMeta = $state<any>({})
  let runtimeError = $state<GrapheneError | null>(null)
  let blankForTests = $state(pathName == '__ct')

  // Convert errors thrown while creating the page component into the same useful display as compilation failures.
  function handlePageError(error: Error) {
    runtimeError = {message: error.message, file: activePage?.path || pathName + '.md'} as GrapheneError
    setErrorFor('compile', runtimeError)
  }
  let fileName = $derived(activePage?.path.split('/').at(-1) || pathName.split('/').at(-1) + '.md')
  let navTitle = $derived(activePage?.title)
  let pageTitle = $derived(pageMeta.title || navTitle || prettyPrintFilename(fileName))

  $effect(() => {
    document.title = `${pageTitle} - ${projectName}`
  })

  onMount(async () => {
    try {
      // force fonts to load before we mount the component.
      // This is important for echarts, as it measures text and if done with the wrong font, then
      // a) when the right font loads, things will just slightly not line up with edges
      // b) test snapshots will differ, as they measure with whatever the system sans font is
      // c) screenshots taken by `graphene run` might have the wrong font
      await document.fonts.load("12px 'Source Sans 3'")
      await document.fonts.ready
      if (blankForTests) return

      if (pathName == '_charts') {
        Page = ChartGallery
      } else if (pathName == '_styles') {
        Page = StyleGallery
      } else if (activePage) {
        let mod = await import(/* @vite-ignore */ '/' + activePage.path)
        Page = mod.default
        pageMeta = mod.metadata || {}
        compileError = null
        setErrorFor('compile', null)
      }
    } catch {
      // async imports give us zero details on error. If we have a compile error from vite, use that, otherwise show something generic
      if (!compileError) {
        let file = activePage?.path || pathName + '.md'
        compileError = {message: `Error loading ${file}`, file} as GrapheneError
        setErrorFor('compile', compileError)
      }
    } finally {
      await tick()
      window.$GRAPHENE.appLoading = false
    }
  })
</script>

<SidebarToggle />

<Sidebar>
  <div class="sb-content pretty-scrollbar">
    <PageNavGroup files={navPages} />
  </div>
</Sidebar>
<div class="query-cache-status-position"><QueryCacheStatus /></div>

<main id="content" class={{pageContent: !pageExists || !!compileError || !!Page, dashboardLayout: pageMeta.layout == 'dashboard'}}>
  {#if blankForTests}
    <!-- render nothing, tests fill in this element -->
  {:else if Page}
    <svelte:boundary onerror={handlePageError}>
      <Page />
      {#snippet failed()}
        <h1 class="page-error-heading">Error loading page</h1>
        <ErrorDisplay error={runtimeError!} />
      {/snippet}
    </svelte:boundary>
  {:else if compileError}
    <h1 class="page-error-heading">Error loading page</h1>
    <ErrorDisplay error={compileError} />
  {:else}
    <!-- page must not exist -->
    {#if isRoot}
      <EmptyPage title="No home page yet" message="Create an index.md file to control what appears here." />
    {:else}
      <EmptyPage title="Page not found" message="Use the menu to select another page." />
    {/if}
  {/if}
</main>

<style>
  /* Position global controls around the viewport; the components only style their own contents. */
  .query-cache-status-position { position: fixed; z-index: 30; top: 10px; right: 10px; }
  .page-error-heading { margin-top: 0; }
</style>
