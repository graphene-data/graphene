<script lang="ts">
  import {onDestroy, onMount, tick} from 'svelte'
  import {setErrorFor} from './telemetry.ts'
  import {PageInputs, activatePageInputs, releasePageInputs, setPageInputsContext} from './pageInputs.svelte.ts'
  import navFiles from 'virtual:nav'
  import Sidebar from './Sidebar.svelte'
  import SidebarToggle from './SidebarToggle.svelte'
  import PageNavGroup from './PageNavGroup.svelte'
  import ErrorDisplay from './ErrorDisplay.svelte'
  import ChartGallery from './ChartGallery.svelte'
  import StyleGallery from './StyleGallery.svelte'
  import {pageCacheState, refreshQueries} from './queryEngine.ts'
  import {type GrapheneError} from '../../lang/index.js'

  let pageInputs = activatePageInputs(new PageInputs())
  setPageInputsContext(pageInputs)

  // Nav sidebar with HMR support for the virtual file list
  let navData = $state(navFiles)
  import.meta.hot?.accept('virtual:nav', mod => navData = mod.default)

  let pathName = window.location.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index'
  // Mirror the server-side folder redirect: if /foo.md doesn't exist but /foo/index.md does, load that.
  if (pathName != 'index' && !navFiles.some(f => f.path == pathName + '.md') && navFiles.some(f => f.path == pathName + '/index.md')) {
    pathName += '/index'
  }

  // Track compile errors from both initial load and subsequent HMR failures.
  let compileError = $state<GrapheneError | null>(null)
  import.meta.hot?.on('vite:error', (payload) => {
    let path = String(payload.err.id || '').split('?')[0].replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!path.endsWith(pathName + '.md')) return // ignore errors on md pages that are not this page

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
  let ageTimer: number | undefined
  let now = $state(Date.now())
  let cacheAge = $derived(formatCacheAge($pageCacheState.oldestCreatedAt, now))

  onMount(async () => {
    ageTimer = window.setInterval(() => (now = Date.now()), 60_000)

    try {
      // force fonts to load before we mount the component.
      // This is important for echarts, as it measures text and if done with the wrong font, then
      // a) when the right font loads, things will just slightly not line up with edges
      // b) test snapshots will differ, as they measure with whatever the system sans font is
      // c) screenshots taken by `graphene run` might have the wrong font
      document.fonts.load("12px 'Source Sans 3'")
      await document.fonts.ready

      if (pathName == '_charts') {
        Page = ChartGallery
      } else if (pathName == '_styles') {
        Page = StyleGallery
      } else if (pathName !== '__ct') {
        let mod = await import(/* @vite-ignore */ '/' + pathName + '.md')
        Page = mod.default
        pageMeta = mod.metadata || {}
        compileError = null
        setErrorFor('compile', null)
      }
    } finally {
      await tick()
      window.$GRAPHENE.appLoading = false
    }
  })

  onDestroy(() => {
    releasePageInputs(pageInputs)
    if (ageTimer) window.clearInterval(ageTimer)
  })

  function formatCacheAge(createdAt: number | undefined, currentTime: number) {
    if (!createdAt) return ''

    let minutes = Math.max(0, Math.floor((currentTime - createdAt) / 60_000))
    if (minutes < 1) return ''
    if (minutes < 60) return `${minutes}m ago`

    let hours = Math.floor(minutes / 60)
    let remainingMinutes = minutes % 60
    return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`
  }
</script>

<SidebarToggle style='position:fixed;top:2rem;left:2rem;opacity:0.3;' />
<Sidebar>
  <PageNavGroup files={navData} />
</Sidebar>

{#if cacheAge}
  <div class="query-cache-status" aria-live="polite">
    <span>Oldest cached result {cacheAge}</span>
    <button type="button" onclick={() => refreshQueries()} disabled={$pageCacheState.loading}>Refresh</button>
  </div>
{/if}

<main id="content" class={{pageContent: compileError || !!Page, dashboardLayout: pageMeta.layout == 'dashboard'}}>
  {#if compileError}
    <h1 class="page-error-heading">Error loading page</h1>
    <ErrorDisplay error={compileError} />
  {:else if Page}
    {#if pageMeta.title}
      <h1>{pageMeta.title}</h1>
    {/if}
    <Page />
  {/if}
</main>

<style>
  main.pageContent {
    margin: 0 auto;
    min-width: 0;
    padding: 20px 6rem 80px;
    max-width: 720px;
  }

  main.pageContent.dashboardLayout {
    max-width: 1200px;
  }

  .page-error-heading { margin-top: 0; }

  /* want to control this margin so it lines up with the SidebarToggle */
  main h1:first-child {
    margin-top: 12px;
  }

  .query-cache-status {
    position: fixed;
    right: 2rem;
    bottom: 2rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    color: #374151;
    font-size: 0.875rem;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  }

  .query-cache-status button {
    border: 1px solid #9ca3af;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    color: #111827;
    background: #fff;
    font: inherit;
    cursor: pointer;
  }

  .query-cache-status button:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .query-cache-status button:disabled {
    color: #9ca3af;
    cursor: wait;
  }
</style>
