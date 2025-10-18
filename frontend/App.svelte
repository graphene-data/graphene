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

<main class="app-shell" class:app-shell--login={$route === '/login'}>
  {#if session && $route !== '/login'}
    <header class="top-bar"></header>
  {/if}

  {#if $route === '/login'}
    <Login />
  {:else}
    <PageView slug={$route} />
  {/if}
</main>

<style>
  .app-shell {
    min-height: 100vh;
    padding: 64px 24px 80px;
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .app-shell--login {
    max-width: 480px;
    justify-content: center;
    padding: 96px 24px;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-radius: 20px;
    border: 1px solid var(--cloud-card-border);
    background: rgba(255, 255, 255, 0.9);
    box-shadow: var(--cloud-card-shadow);
    backdrop-filter: blur(10px);
  }

  nav {
    display: flex;
    gap: 16px;
  }

  nav a {
    color: var(--cloud-text-muted);
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 999px;
    transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
  }

  nav a.active {
    background: rgba(59, 130, 246, 0.12);
    color: var(--primary);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
  }

  .link {
    border: none;
    background: transparent;
    color: var(--cloud-text-muted);
    cursor: pointer;
    font-size: 15px;
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: 40px 16px 56px;
    }

    .app-shell--login {
      padding: 56px 20px;
    }

    .top-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
