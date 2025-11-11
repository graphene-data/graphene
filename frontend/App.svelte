<script lang="ts">
  import {session} from './authClient'
  import Login from './routes/Login.svelte'
  import Authenticate from './routes/Authenticate.svelte'
  import PageView from './routes/PageView.svelte'
  import {route, go} from './router'

  $: {
    if (!$session) {
      let next = encodeURIComponent(`${window.location.pathname || '/'}${window.location.search || ''}`)
      if ($route !== '/login') go(`/login?next=${next}`)
    }
  }
</script>

<main class="app-shell" class:app-shell--login={$route === '/login'}>
  {#if $route === '/login'}
    <Login />
  {:else if $route === '/authenticate'}
    <Authenticate />
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
