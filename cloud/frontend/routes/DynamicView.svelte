<script lang="ts">
  import {onDestroy, mount, unmount} from 'svelte'

  type DynamicError = {
    message: string
  }

  let container: HTMLElement
  let instance: any
  let loading = $state(true)
  let error = $state<DynamicError | null>(null)

  async function loadDynamic() {
    loading = true
    error = null

    if (instance) unmount(instance)
    instance = null
    // eslint-disable-next-line svelte/no-dom-manipulating -- clearing container before mounting the compiled dynamic module
    if (container) container.innerHTML = ''

    try {
      let params = new URLSearchParams(window.location.search)
      let md = params.get('md')
      let repoId = params.get('repoId')

      if (!md || !repoId) throw new Error('Missing required query params: md and repoId')

      let res = await fetch(`/_api/dynamic/module?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(repoId)}`)
      if (!res.ok) {
        let message = 'Failed to compile dynamic markdown.'
        try {
          let body = await res.json() as {error?: string}
          message = body.error || message
        } catch {
          // ignore invalid non-JSON error responses
        }
        throw new Error(message)
      }

      let code = await res.text()
      let blob = new Blob([code], {type: 'text/javascript'})
      let url = URL.createObjectURL(blob)
      let mod = await import(/* @vite-ignore */ url)
      URL.revokeObjectURL(url)

      instance = mount(mod.default, {target: container})
    } catch(cause) {
      error = {message: cause instanceof Error ? cause.message : 'Failed to load dynamic markdown.'}
    } finally {
      loading = false
    }
  }

  $effect(() => {
    loadDynamic()
  })

  onDestroy(() => {
    if (instance) unmount(instance)
  })
</script>

<main id="content" class="run-md-screenshot">
  {#if loading}<p class="muted">Loading…</p>
  {:else if error}<p class="error">{error.message}</p>{/if}
  <div bind:this={container} class:hidden={loading || !!error}></div>
</main>

<style>
  .muted {
    color: #64748b;
  }

  .error {
    color: #b91c1c;
  }
</style>
