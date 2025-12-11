<script lang="ts">
  import {session} from './authClient.ts'
  import Login from './routes/Login.svelte'
  import Authenticate from './routes/Authenticate.svelte'
  import PageView from './routes/PageView.svelte'
  import {route, go} from './router.ts'

  $: {
    if (!$session) {
      let next = encodeURIComponent(`${window.location.pathname || '/'}${window.location.search || ''}`)
      next = next != '%2F' ? `?next=${next}` : ''
      if ($route !== '/login') go(`/login${next}`)
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

  @media (max-width: 720px) {
    .app-shell {
      padding: 40px 16px 56px;
    }

    .app-shell--login {
      padding: 56px 20px;
    }
  }
</style>
