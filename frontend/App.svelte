<script lang="ts">
  import {createAuthClient} from './authClient'
  import Login from './routes/Login.svelte'
  import AdminConnections from './routes/admin/Connections.svelte'
  import AdminHome from './routes/admin/Home.svelte'
  import PageView from './routes/PageView.svelte'
  import {route, go} from './router'

  let stytch = createAuthClient()
  let session = stytch.session.getSync()

  $: {
    if (!session) go('/login')
  }
</script>

<main class="app-shell">
  {#if session}
    <header class="top-bar"></header>
  {/if}

  {#if $route === '/login'}
    <Login />
  {:else}
    <PageView slug={$route} />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0d1117;
    color: #f6f8fa;
  }

  .app-shell {
    min-height: 100vh;
    padding: 32px 16px 64px;
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  }

  nav {
    display: flex;
    gap: 16px;
  }

  nav a {
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;
    font-size: 14px;
    padding: 6px 10px;
    border-radius: 999px;
  }

  nav a.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .link {
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 14px;
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: 24px 12px 48px;
    }

    .top-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
