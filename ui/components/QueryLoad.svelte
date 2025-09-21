<script lang="ts">
  import {createEventDispatcher, onDestroy} from 'svelte'
  import isEmptyDataset from '@evidence-dev/component-utilities/isEmptyDataset'

  export let data: unknown
  export let height = 200
  export let skeletonClass: string | undefined = undefined

  declare global {
    interface Window {
      $GRAPHENE?: {
        query: (name: string) => Promise<any[]>
      }
    }
  }

  type LoadedState = any

  const dispatch = createEventDispatcher()

  let loaded: LoadedState
  let loading = false
  let loadError: Error | undefined
  let unsubscribe: (() => void) | undefined
  let token = 0

  $: handleSource(data)

  function updateLoaded (value: LoadedState) {
    loaded = value
    dispatch('loaded', loaded)
  }

  async function handleSource (source: unknown) {
    token += 1
    let current = token

    detach()
    updateLoaded(undefined)
    loadError = undefined

    if (isEvidenceLikeQuery(source)) {
      followQuery(source)
      return
    }

    let resolved = await resolveDeferred(source, current)
    if (current !== token) return

    if (resolved instanceof Error) {
      loadError = resolved
      updateLoaded({error: resolved})
      return
    }

    if (Array.isArray(resolved)) {
      updateLoaded(attachMetadata(resolved))
      return
    }

    if (isResultLike(resolved)) {
      updateLoaded(attachMetadata(resolved.rows ?? [], resolved.queryName))
      return
    }

    if (typeof resolved === 'string') {
      await fetchByName(resolved, current)
      return
    }

    if (resolved != null) {
      updateLoaded(resolved)
    }
  }

  function detach () {
    if (unsubscribe) unsubscribe()
    unsubscribe = undefined
  }

  function isEvidenceLikeQuery (value: unknown): value is {fetch: () => Promise<void>, subscribe: (cb: (state: any) => void) => () => void} {
    return Boolean(value && typeof value === 'object' && 'fetch' in value && typeof (value as any).fetch === 'function' && typeof (value as any).subscribe === 'function')
  }

  function followQuery (query: {fetch: () => Promise<void>, subscribe: (cb: (state: any) => void) => () => void}) {
    try {
      query.fetch()
    } catch {}

    unsubscribe = query.subscribe((value: any) => {
      updateLoaded(value)
      loadError = value?.error
    })
  }

  async function resolveDeferred (value: unknown, current: number) {
    if (value && typeof value === 'object' && 'then' in value && typeof (value as Promise<any>).then === 'function') {
      loading = true
      try {
        let resolved = await (value as Promise<any>)
        if (current !== token) return undefined
        loading = false
        return resolved
      } catch (error) {
        loading = false
        return error instanceof Error ? error : new Error('Unable to resolve data source')
      }
    }

    return value
  }

  function isResultLike (value: unknown): value is {rows?: any[], queryName?: string} {
    return Boolean(value && typeof value === 'object' && 'rows' in value)
  }

  async function fetchByName (queryName: string, current: number) {
    if (typeof window === 'undefined') return
    if (!window?.$GRAPHENE?.query) {
      loadError = new Error('Graphene runtime is not available')
      loaded = {error: loadError}
      return
    }

    loading = true
    try {
      let rows = await window.$GRAPHENE.query(queryName)
      if (current !== token) return
      updateLoaded(attachMetadata(rows ?? [], queryName))
    } catch (error) {
      if (current !== token) return
      loadError = error instanceof Error ? error : new Error('Query failed')
      updateLoaded({error: loadError})
    } finally {
      if (current === token) loading = false
    }
  }

  function attachMetadata (rows: any[], queryName?: string) {
    let result = Array.isArray(rows) ? [...rows] : []
    try {
      Object.defineProperty(result, 'dataLoaded', {value: true, configurable: true})
      if (queryName) Object.defineProperty(result, 'queryName', {value: queryName, configurable: true})
    } catch {
      // ignore metadata failures
    }
    return result
  }

  onDestroy(detach)

  const isEmpty = (value: unknown) => {
    if (Array.isArray(value)) return isEmptyDataset(value)
    return false
  }
</script>

{#if !data}
  <slot loaded={loaded} />
{:else if loadError && $$slots.error}
  <slot name="error" loaded={{error: loadError}} />
{:else if loading}
  <slot name="skeleton" loaded={loaded}>
    <div class={`ql-skeleton ${skeletonClass ?? ''}`} style={`height:${height}px`} role="status" aria-live="polite">
      <span class="ql-skeleton__pulse" />
    </div>
  </slot>
{:else if isEmpty(loaded) && $$slots.empty}
  <slot name="empty" loaded={loaded} />
{:else}
  <slot loaded={loaded ?? data} />
{/if}

<style>
  .ql-skeleton {
    width: 100%;
    position: relative;
    overflow: hidden;
    background: var(--chart-skeleton-bg, #f3f4f6);
    border-radius: 4px;
  }

  .ql-skeleton__pulse {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
    animation: ql-pulse 1.4s ease-in-out infinite;
    content: '';
  }

  @keyframes ql-pulse {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
