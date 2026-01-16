<script lang="ts">
  import {onMount} from 'svelte'

  type AvailableRepo = {
    id: string
    name: string
    fullName: string
    url: string
    defaultBranch: string
    added: boolean
    repoId: string | null
  }

  let loading = true
  let error = ''
  let hasInstallation = false
  let availableRepos: AvailableRepo[] = []
  let adding = false
  let removing: string | null = null

  // Form state for adding a repo
  let selectedRepo: AvailableRepo | null = null
  let slug = ''
  let folder = ''

  onMount(async () => {
    try {
      let res = await fetch('/_api/github/repos')
      if (!res.ok) throw new Error('Failed to fetch repos')
      let data = await res.json()
      availableRepos = data.repos
      hasInstallation = data.hasInstallation
    } catch (e: any) {
      error = e.message
    } finally {
      loading = false
    }
  })

  function connectGitHub () {
    window.location.href = '/_api/github/install'
  }

  function selectRepo (repo: AvailableRepo) {
    selectedRepo = repo
    slug = repo.name
    folder = ''
  }

  function cancelSelection () {
    selectedRepo = null
    slug = ''
    folder = ''
  }

  async function addRepo () {
    if (!selectedRepo) return
    adding = true
    error = ''

    try {
      let res = await fetch('/_api/github/repos', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          vcsRepoId: selectedRepo.id,
          slug,
          folder: folder || undefined,
        }),
      })
      let data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add repo')
      }

      // Mark as added and store the repoId
      availableRepos = availableRepos.map(r =>
        r.id === selectedRepo!.id ? {...r, added: true, repoId: data.repo.id} : r,
      )
      selectedRepo = null
      slug = ''
      folder = ''
    } catch (e: any) {
      error = e.message
    } finally {
      adding = false
    }
  }

  async function removeRepo (repo: AvailableRepo) {
    if (!repo.repoId) return
    removing = repo.id
    error = ''

    try {
      let res = await fetch(`/_api/repos/${repo.repoId}`, {method: 'DELETE'})
      if (!res.ok) {
        let data = await res.json()
        throw new Error(data.error || 'Failed to remove repo')
      }

      // Mark as not added
      availableRepos = availableRepos.map(r =>
        r.id === repo.id ? {...r, added: false, repoId: null} : r,
      )
    } catch (e: any) {
      error = e.message
    } finally {
      removing = null
    }
  }
</script>

<section class="repos-page">
  <div class="header">
    <h1>Repositories</h1>
    {#if hasInstallation}
      <button class="connect-btn" on:click={connectGitHub}>
        Connect GitHub
      </button>
    {/if}
  </div>

  {#if loading}
    <p>Loading available repositories...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if !hasInstallation}
    <div class="empty-state">
      <p>Connect your GitHub account to sync repositories with Graphene.</p>
      <button class="connect-btn" on:click={connectGitHub}>Connect GitHub</button>
    </div>
  {:else if availableRepos.length === 0}
    <div class="empty-state">
      <p>No repositories available. Grant access to repositories in your GitHub App settings.</p>
      <button class="connect-btn" on:click={connectGitHub}>Manage GitHub App</button>
    </div>
  {:else if selectedRepo}
    <div class="add-form">
      <h2>Configure {selectedRepo.fullName}</h2>

      <label class="field">
        <span class="label">Slug</span>
        <input type="text" bind:value={slug} placeholder="my-repo" />
        <span class="hint">The name used to identify this repo in Graphene</span>
      </label>

      <label class="field">
        <span class="label">Folder (optional)</span>
        <input type="text" bind:value={folder} />
        <span class="hint">Subfolder to use as the Graphene root. Leave empty to use repo root.</span>
      </label>

      <div class="form-actions">
        <button class="secondary-btn" on:click={cancelSelection} disabled={adding}>Cancel</button>
        <button class="primary-btn" on:click={addRepo} disabled={adding || !slug}>
          {adding ? 'Adding...' : 'Add Repository'}
        </button>
      </div>
    </div>
  {:else}
    <p class="description">Select a repository to add to Graphene. Only .md and .gsql files will be synced.</p>

    <ul class="repo-list">
      {#each availableRepos as repo (repo.id)}
        <li class="repo-item">
          <div class="repo-info">
            <span class="repo-name">{repo.fullName}</span>
            <span class="repo-branch">{repo.defaultBranch}</span>
          </div>
          {#if repo.added}
            <button class="remove-btn" on:click={() => removeRepo(repo)} disabled={removing === repo.id}>
              {removing === repo.id ? 'Removing...' : 'Remove'}
            </button>
          {:else}
            <button class="add-btn" on:click={() => selectRepo(repo)}>Add</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .repos-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }

  .connect-btn {
    background: #24292f;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .connect-btn:hover {
    background: #32383f;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 16px;
  }

  .description {
    color: #666;
    margin: 0;
  }

  .repo-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    overflow: hidden;
  }

  .repo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e9ecef;
  }

  .repo-item:last-child {
    border-bottom: none;
  }

  .repo-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .repo-name {
    font-weight: 500;
  }

  .repo-branch {
    font-size: 13px;
    color: #666;
  }

  .add-btn {
    background: #24292f;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #32383f;
  }

  .remove-btn {
    background: white;
    color: #dc3545;
    border: 1px solid #dc3545;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .remove-btn:hover:not(:disabled) {
    background: #dc3545;
    color: white;
  }

  .remove-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .add-form {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 24px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .label {
    font-weight: 500;
    font-size: 14px;
  }

  .field input {
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .field input:focus {
    outline: none;
    border-color: #24292f;
  }

  .hint {
    font-size: 13px;
    color: #666;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .primary-btn {
    background: #24292f;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .primary-btn:hover:not(:disabled) {
    background: #32383f;
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .secondary-btn {
    background: white;
    color: #333;
    border: 1px solid #ddd;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .secondary-btn:hover:not(:disabled) {
    background: #f5f5f5;
  }

  .secondary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .empty-state p {
    color: #666;
    margin: 0 0 16px;
  }

  .error {
    color: #721c24;
    background: #f8d7da;
    padding: 12px;
    border-radius: 6px;
  }
</style>
