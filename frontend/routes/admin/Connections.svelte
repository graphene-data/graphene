<script lang="ts">
  import {onMount} from 'svelte'

  type Connection = {
    id: number
    label: string
    kind: string
    configJson: string
    updatedAt: number | null
  }

  let connections: Connection[] = []
  let formLabel = 'local-duckdb'
  let formKind = 'duckdb'
  let formConfig = `{
  "catalog": "main",
  "schema": "main",
  "database_path": "../examples/flights/flights.duckdb"
}`
  let busy = false
  let error = ''
  let success = ''

  const loadConnections = async () => {
    let response = await authedFetch('/_admin/connections')
    let payload = await response.json()
    connections = payload.items ?? []
  }

  const saveConnection = async () => {
    busy = true
    error = ''
    success = ''
    try {
      let config = JSON.parse(formConfig)
      await authedFetch('/_admin/connections', {
        method: 'POST',
        body: JSON.stringify({label: formLabel, kind: formKind, config}),
      })
      await loadConnections()
      success = 'Connection saved.'
    } catch (cause) {
      console.error(cause)
      error = cause instanceof SyntaxError ? 'Config must be valid JSON.' : cause instanceof Error ? cause.message : 'Failed to save connection.'
    } finally {
      busy = false
    }
  }

  const deleteConnection = async (label: string) => {
    error = ''
    success = ''
    try {
      await authedFetch(`/_admin/connections/${encodeURIComponent(label)}`, {
        method: 'DELETE',
      })
      await loadConnections()
    } catch (cause) {
      console.error(cause)
      error = cause instanceof Error ? cause.message : 'Failed to delete connection.'
    }
  }

  const submit = async (event: Event) => {
    event.preventDefault()
    await saveConnection()
  }

  onMount(() => {
    loadConnections().catch((cause) => {
      console.error(cause)
      error = cause instanceof Error ? cause.message : 'Failed to load connections.'
    })
  })
</script>

<section class="card">
  <h1>Connections</h1>
  <p class="muted">Define database targets Graphene Cloud can query against.</p>

  {#if error}
    <p class="alert">{error}</p>
  {/if}
  {#if success}
    <p class="success">{success}</p>
  {/if}

  <form class="form" on:submit={submit}>
    <label>
      Label
      <input bind:value={formLabel} required />
    </label>
    <label>
      Kind
      <input bind:value={formKind} required />
    </label>
    <label>
      Config JSON
      <textarea rows="8" bind:value={formConfig}></textarea>
    </label>
    <button type="submit" disabled={busy}>
      {busy ? 'Saving…' : 'Save connection'}
    </button>
  </form>
</section>

<section class="card">
  <h2>Saved connections</h2>
  {#if connections.length === 0}
    <p class="muted">Nothing yet.</p>
  {:else}
    <ul>
      {#each connections as conn}
        <li>
          <div>
            <strong>{conn.label}</strong>
            <span class="muted">{conn.kind}</span>
            {#if conn.updatedAt}
              <span class="muted small">Updated {new Date(conn.updatedAt).toLocaleString()}</span>
            {/if}
          </div>
          <button class="link" on:click={() => deleteConnection(conn.label)}>Remove</button>
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

  h1 {
    margin: 0;
    font-size: 24px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
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

  .success {
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(67, 211, 148, 0.12);
    border: 1px solid rgba(67, 211, 148, 0.35);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }

  input,
  textarea,
  button {
    font-family: inherit;
  }

  input,
  textarea {
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.4);
    color: inherit;
    padding: 10px 12px;
    border-radius: 10px;
  }

  textarea {
    resize: vertical;
  }

  button {
    align-self: flex-start;
    padding: 10px 20px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(90deg, #4f46e5, #9333ea);
    color: #fff;
    cursor: pointer;
    font-weight: 500;
  }

  button[disabled] {
    opacity: 0.6;
    cursor: wait;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .link {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 6px 12px;
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

    li {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
