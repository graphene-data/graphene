<script lang="ts">
  import {session} from './authClient.ts'
  import Login from './routes/Login.svelte'
  import Authenticate from './routes/Authenticate.svelte'
  import PageView from './routes/PageView.svelte'
  import Settings from './routes/Settings.svelte'
  import NavSidebar from '../../core/ui/internal/NavSidebar.svelte'
  import {route, go} from './router.ts'

  let navFiles: string[] = []

  $: {
    if (!$session) {
      let next = encodeURIComponent(`${window.location.pathname || '/'}${window.location.search || ''}`)
      next = next != '%2F' ? `?next=${next}` : ''
      if ($route !== '/login') go(`/login${next}`)
    }
  }

  $: repoSlug = $route.split('/')[1] || ''

  $: if ($session && repoSlug) {
    fetchNavFiles(repoSlug)
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

</script>

{#if $route === '/login'}
  <main class="app-shell app-shell--login">
    <Login />
  </main>
{:else if $route === '/authenticate'}
  <main class="app-shell app-shell--login">
    <Authenticate />
  </main>
{:else if $route.startsWith('/settings')}
  <main class="app-shell">
    <Settings />
  </main>
{:else}
  <div class="app-layout">
    {#if navFiles.length > 1}
      <nav class="sidebar">
        <NavSidebar files={navFiles} onNavigate={go} baseRoute={repoSlug} />
      </nav>
    {/if}
    <main class="app-shell" class:app-shell--with-sidebar={navFiles.length > 1}>
      <PageView slug={$route} />
    </main>
  </div>
{/if}

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    padding: 64px 0 24px 24px;
    border-right: 1px solid rgba(15, 23, 42, 0.08);
  }

  .app-shell {
    flex: 1;
    min-height: 100vh;
    padding: 64px 24px 80px;
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .app-shell--with-sidebar {
    margin: 0;
    padding-left: 48px;
  }

  .app-shell--login {
    max-width: 480px;
    justify-content: center;
    padding: 96px 24px;
  }

  @media (max-width: 720px) {
    .sidebar {
      display: none;
    }

    .app-shell {
      padding: 40px 16px 56px;
    }

    .app-shell--with-sidebar {
      margin: 0 auto;
      padding-left: 16px;
    }

    .app-shell--login {
      padding: 56px 20px;
    }
  }
</style>
