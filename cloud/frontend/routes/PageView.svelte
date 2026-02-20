<script lang="ts">
  import {onDestroy, mount, unmount} from 'svelte'
  import {go} from '../router.ts'
  import NavSidebar from '../../../core/ui/internal/NavSidebar.svelte'
  import ErrorDisplay from '../../../core/ui/internal/ErrorDisplay.svelte'

  let {slug}: {slug: string} = $props()

  type PageErrorState = {
    kind: 'compile' | 'load'
    message: string
    file?: string
  }

  type CompileFailure = {
    kind: 'compile'
    file: string
  }

  let container: HTMLElement
  let instance: any
  let loading = $state(true)
  let error = $state<PageErrorState | null>(null)
  let navFiles: string[] = $state([])

  let repoSlug = $derived(slug.split('/')[1] || '')

  $effect(() => {
    if (repoSlug) fetchNavFiles(repoSlug)
  })

  function toMarkdownFile (target: string) {
    let segments = target.split('/').filter(Boolean)
    let pageSegments = segments.length > 1 ? segments.slice(1) : segments
    let filePath = pageSegments.join('/') || 'index'
    return `${filePath}.md`
  }

  function isCompileFailure (value: unknown): value is CompileFailure {
    return !!value && typeof value === 'object' && (value as CompileFailure).kind === 'compile'
  }

  async function fetchNavFiles (slug: string) {
    try {
      let res = await fetch(`/_api/nav/${slug}`)
      if (res.ok) navFiles = await res.json()
      else navFiles = []
    } catch (e) {
      console.error('Failed to fetch nav files:', e)
      navFiles = []
    }
  }

  const loadPage = async (target: string) => {
    loading = true
    error = null
    if (instance) unmount(instance)
    instance = null
    // eslint-disable-next-line svelte/no-dom-manipulating -- clearing container for dynamic svelte component mount
    if (container) container.innerHTML = ''
    try {
      let pagePath = target.replace(/\/*$/, '') || '/'
      let res = await fetch(`/_api/pages${pagePath}`)
      if (!res.ok) {
        if (res.status >= 500) {
          throw {kind: 'compile', file: toMarkdownFile(target)} satisfies CompileFailure
        }
        let message = 'Failed to load page.'
        try {
          let body = await res.json()
          message = body.error || message
        } catch {
          // ignore invalid non-JSON error responses
        }
        throw new Error(message)
      }

      let contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        let body = await res.json()
        if (body.redirect) return go(body.redirect)
      }

      let code = contentType.includes('json') ? '' : await res.text()
      let blob = new Blob([code], {type: 'text/javascript'})
      let mod = await import(/* @vite-ignore */ URL.createObjectURL(blob))
      instance = mount(mod.default, {target: container})
    } catch (cause) {
      if (isCompileFailure(cause)) {
        error = {
          kind: 'compile',
          file: cause.file,
          message: `${cause.file} failed to compile.`,
        }
      } else {
        console.error(cause)
        error = {
          kind: 'load',
          message: cause instanceof Error ? cause.message : 'Failed to load page.',
        }
      }
    } finally {
      loading = false
    }
  }

  let currentSlug = $state('')

  $effect(() => {
    if (slug && slug !== currentSlug) {
      currentSlug = slug
      loadPage(slug)
    }
  })

  onDestroy(() => {
    if (instance) unmount(instance)
  })
</script>

{#if navFiles.length > 1}
  <nav>
    <NavSidebar files={navFiles} onNavigate={go} baseRoute={repoSlug} />
  </nav>
{/if}

<main>
  {#if loading}<p class="muted">Loading…</p>
  {:else if error}
    <ErrorDisplay error={{message: error.message, file: error.file}} />
  {/if}
  <div bind:this={container} class:hidden={loading || error}></div>
</main>

<style>
  .muted {
    color: rgba(255, 255, 255, 0.65);
  }
</style>
