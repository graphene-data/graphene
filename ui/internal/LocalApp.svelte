<script>
  import {errorProvider} from './telemetry.ts'
  import navFiles from 'virtual:nav'
  import NavSidebar from './NavSidebar.svelte'
  import PageError from './PageError.svelte'

  // Nav sidebar with HMR support for the virtual file list
  let navData = $state(navFiles)
  import.meta.hot?.accept('virtual:nav', mod => navData = mod.default)

  // Track compile errors from both initial load and subsequent HMR failures.
  // Uses errorProvider so `check` can report compilation errors.
  let compileError = $state(null)
  errorProvider('compile', () => compileError ? [compileError] : [])
  import.meta.hot?.on('vite:error', (payload) => {
    compileError = payload.err
    compileError.type = 'compile'
    compileError.file = payload.err.id
    Page = null
  })

  // The md file is dynamically imported, so even if there's a compile error, we'll still load LocalApp and can show the user the issue
  let Page = $state(null)
  let pathName = window.location.pathname.replace(/^\//, '') || 'index'
  if (pathName !== '__ct') {
    import(/* @vite-ignore */ '/' + pathName + '.md').then(mod => {
      Page = mod.default
      compileError = null
    }).catch(() => {})
  }
</script>

<nav id="nav"><NavSidebar files={navData} /></nav>
<main id="content">
  {#if compileError}
    <PageError error={compileError} />
  {:else if Page}
    <Page />
  {/if}
</main>
