<script lang="ts">
  import {onDestroy, onMount} from 'svelte'
  import {errorProvider} from './telemetry.ts'
  import {PageInputs, activatePageInputs, releasePageInputs, setPageInputsContext} from './pageInputs.svelte.ts'
  import navFiles from 'virtual:nav'
  import NavSidebar from './NavSidebar.svelte'
  import ErrorDisplay from './ErrorDisplay.svelte'
  import DevEChartsGallery from './DevEChartsGallery.svelte'

  let pageInputs = activatePageInputs(new PageInputs())
  setPageInputsContext(pageInputs)
  onDestroy(() => releasePageInputs(pageInputs))

  // Nav sidebar with HMR support for the virtual file list
  let navData = $state(navFiles)
  import.meta.hot?.accept('virtual:nav', mod => navData = mod.default)

  // Track compile errors from both initial load and subsequent HMR failures.
  // Uses errorProvider so `check` can report compilation errors.
  let compileError = $state(null)
  errorProvider('compile', () => compileError ? [compileError] : [])
  import.meta.hot?.on('vite:error', (payload) => {
    let line = Math.max(0, (payload.err.loc?.line || 1) - 1)
    let col = Math.max(0, payload.err.loc?.column || 0)
    let path = String(payload.err.id || '').replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
    let message = String(payload.err.message || '').replace(/^.*?:\d+:\d+\s*/, '').replace(/\s*https:\/\/svelte\.dev\/\S+/g, '').trim()
    compileError = {
      message,
      frame: payload.err.frame,
      file: path,
      from: {line, col, offset: 0},
      to: {line, col: col + 1, offset: 0},
    }
    Page = null
  })

  // The md file is dynamically imported, so even if there's a compile error, we'll still load LocalApp and can show the user the issue
  let Page = $state(null)

  onMount(async () => {
    let pathName = window.location.pathname.replace(/^\//, '') || 'index'

    // force fonts to load before we mount the component.
    // This is important for echarts, as it measures text and if done with the wrong font, then
    // a) when the right font loads, things will just slightly not line up with edges
    // b) test snapshots will differ, as they measure with whatever the system sans font is
    // c) screenshots taken by `graphene run` might have the wrong font
    document.fonts.load("12px 'Source Sans 3'")
    await document.fonts.ready

    if (pathName == '__dev/echarts') {
      Page = DevEChartsGallery
    } else if (pathName !== '__ct') {
      let mod = await import(/* @vite-ignore */ '/' + pathName + '.md')
      Page = mod.default
      compileError = null
    }
  })
</script>

<nav id="nav"><NavSidebar files={navData} /></nav>
<main id="content">
  {#if compileError}
    <h1 class="page-error-heading">Error loading page</h1>
    <ErrorDisplay error={compileError} />
  {:else if Page}
    <Page />
  {/if}
</main>

<style>
  .page-error-heading { margin-top: 0; }
</style>
