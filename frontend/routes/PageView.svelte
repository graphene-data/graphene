<script lang="ts">
  import {onDestroy} from 'svelte'
  import {go} from '../router.ts'

  export let slug: string

  let content
  let container: HTMLElement
  let instance: any
  let loading = true
  let error = ''

  const loadPage = async (target: string) => {
    loading = true
    error = ''
    instance?.$destroy()
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
      instance = new mod.default({target: container})
    } catch (cause) {
      console.error(cause)
      error = cause instanceof Error ? cause.message : 'Failed to load page.'
      content = null
    } finally {
      loading = false
    }
  }

  let currentSlug = ''

  $: if (slug && slug !== currentSlug) {
    currentSlug = slug
    loadPage(slug)
  }

  onDestroy(() => {
    instance?.$destroy()
  })
</script>

<section class="page">
  {#if loading}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="alert">{error}</p>
  {:else}
    <svelte:component this={content} />
  {/if}
  <div bind:this={container} class:hidden={loading || error}></div>
</section>

<style>
  .page {
    background: rgba(255, 255, 255, 0.05);
    padding: 28px;
    border-radius: 18px;
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.25);
  }

  .muted {
    color: rgba(255, 255, 255, 0.65);
  }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 83, 83, 0.12);
    border: 1px solid rgba(255, 83, 83, 0.35);
  }

  .page :global(h1) {
    margin: 0 0 12px;
    font-size: 26px;
  }

  .page :global(.meta) {
    margin: 0 0 16px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  .page :global(pre) {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
    font-size: 15px;
  }

  @media (max-width: 720px) {
    .page {
      padding: 22px;
    }
  }
</style>
