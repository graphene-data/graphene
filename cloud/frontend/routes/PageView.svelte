<script lang="ts">
  import {onDestroy, mount, unmount} from 'svelte'
  import {go} from '../router.ts'
  import NavSidebar from '../../../core/ui/internal/NavSidebar.svelte'

  let {slug}: {slug: string} = $props()

  let container: HTMLElement
  let instance: any
  let loading = $state(true)
  let error = $state('')
  let navFiles: string[] = $state([])

  let repoSlug = $derived(slug.split('/')[1] || '')

  $effect(() => {
    if (repoSlug) fetchNavFiles(repoSlug)
  })

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
    error = ''
    if (instance) unmount(instance)
    instance = null
    // eslint-disable-next-line svelte/no-dom-manipulating -- clearing container for dynamic svelte component mount
    if (container) container.innerHTML = ''
    try {
      let pagePath = target.replace(/\/*$/, '') || '/'
      let res = await fetch(`/_api/pages${pagePath}`)
      if (!res.ok) {
        let body = await res.json()
        throw new Error(body.error || 'Failed to load page')
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
      console.error(cause)
      error = cause instanceof Error ? cause.message : 'Failed to load page.'
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
  {:else if error}<p class="alert">{error}</p>
  {/if}
  <div bind:this={container} class:hidden={loading || error}></div>
</main>

<style>
  .muted {
    color: rgba(255, 255, 255, 0.65);
  }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 83, 83, 0.12);
    border: 1px solid rgba(255, 83, 83, 0.35);
  }
</style>
