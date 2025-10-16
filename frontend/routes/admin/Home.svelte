<script lang="ts">
  import {onMount} from 'svelte'

  type ConnectionSummary = {
    label: string
    kind: string
    updatedAt: number | null
  }

  type PageSummary = {
    slug: string
    title: string | null
    updatedAt: number | null
  }

  let status = 'Loading Graphene Cloud...'
  let org = ''
  let pages: PageSummary[] = []
  let connections: ConnectionSummary[] = []
  let error = ''
  let loading = true

  const load = async () => {
    loading = true
    error = ''
    try {
      let statusResponse = await authedFetch('/_admin/status')
      let statusPayload = await statusResponse.json()
      status = statusPayload.message ?? 'Ready'
      org = statusPayload.org?.slug ?? ''

      let connectionResponse = await authedFetch('/_admin/connections')
      let connectionPayload = await connectionResponse.json()
      connections = connectionPayload.items ?? []

      let pageResponse = await fetch('/_api/pages')
      if (pageResponse.ok) {
        let pagePayload = await pageResponse.json()
        pages = pagePayload.items ?? []
      }
    } catch (cause) {
      console.error(cause)
      error = cause instanceof Error ? cause.message : 'Failed to load admin data'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    load()
  })
</script>

<section class="card">
  <header>
    <div>
      <h1>Organization</h1>
      <p class="muted">{org || 'Unknown org'}</p>
    </div>
    <button class="link" on:click={() => navigate('/admin/connections')}>
      Manage connections
    </button>
  </header>

  {#if error}
    <p class="alert">{error}</p>
  {:else}
    <p class="status">{status}</p>
  {/if}
</section>

<section class="card">
  <h2>Connections</h2>
  {#if loading}
    <p class="muted">Loading...</p>
  {:else if connections.length === 0}
    <p class="muted">No saved connections yet.</p>
  {:else}
    <ul>
      {#each connections as conn}
        <li>
          <strong>{conn.label}</strong>
          <span class="muted">{conn.kind}</span>
          {#if conn.updatedAt}
            <span class="muted small">Updated {new Date(conn.updatedAt).toLocaleString()}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card">
  <h2>Markdown pages</h2>
  {#if loading}
    <p class="muted">Loading...</p>
  {:else if pages.length === 0}
    <p class="muted">No pages yet.</p>
  {:else}
    <ul>
      {#each pages as page}
        <li>
          <a href={`/${page.slug}`} on:click={(event) => { event.preventDefault(); navigate(`/${page.slug}`) }}>
            {page.slug}
          </a>
          {#if page.title}
            <span class="muted">— {page.title}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card {
    background: rgba(255, 255, 255, 0.05);
    padding: 24px;
    border-radius: 18px;
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h1 {
    margin: 0;
    font-size: 24px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
  }

  .muted {
    color: rgba(255, 255, 255, 0.65);
    margin: 0;
  }

  .muted.small {
    font-size: 12px;
  }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 83, 83, 0.12);
    border: 1px solid rgba(255, 83, 83, 0.35);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  li {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 14px;
  }

  a {
    color: #9abaff;
    text-decoration: none;
  }

  .link {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 8px 14px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 13px;
  }

  .link:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  @media (max-width: 720px) {
    .card {
      padding: 20px;
    }

    header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
