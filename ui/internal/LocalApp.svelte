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

  let pathName = window.location.pathname.replace(/^\//, '') || 'index'
  let ageTimer: number | undefined

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
  let now = $state(Date.now())
  let cacheAge = $derived(formatCacheAge($pageCacheState.oldestCreatedAt, now))

  onMount(async () => {
    ageTimer = window.setInterval(() => now = Date.now(), 60_000)

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

  function formatCacheAge(createdAt: number | undefined, timestamp: number) {
    if (!createdAt) return ''

    let ageMs = Math.max(0, timestamp - createdAt)
    let minutes = Math.floor(ageMs / 60_000)
    if (minutes < 1) return 'under 1m old'
    if (minutes < 60) return `${minutes}m old`

    let hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h old`

    return `${Math.floor(hours / 24)}d old`
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

  .query-cache-status {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: calc(100vw - 4rem);
    padding: 6px 8px 6px 10px;
    border: 1px solid #d9dee7;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    color: #475569;
    font-size: 12px;
    line-height: 1.2;
  }

  .query-cache-status button {
    flex: 0 0 auto;
    min-height: 26px;
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    background: #fff;
    color: #1f2937;
    font: inherit;
    cursor: pointer;
  }

  .query-cache-status button:hover:not(:disabled) {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  .query-cache-status button:disabled {
    cursor: default;
    opacity: 0.55;
  }

  @media (max-width: 720px) {
    .query-cache-status {
      top: 1.25rem;
      right: 1rem;
      max-width: calc(100vw - 5rem);
    }
  }

  /* want to control this margin so it lines up with the SidebarToggle */
  main h1:first-child {
    margin-top: 12px;
  }
</style>
