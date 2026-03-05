<script lang="ts">
  import {session} from './authClient.ts'
  import Login from './routes/Login.svelte'
  import PageView from './routes/PageView.svelte'
  import Settings from './routes/Settings.svelte'
  import ChatPreview from './routes/ChatPreview.svelte'
  import {route, go} from './router.ts'

  $effect(() => {
    if (!$session) {
      let next = encodeURIComponent(`${window.location.pathname || '/'}${window.location.search || ''}`)
      next = next != '%2F' ? `?next=${next}` : ''
      if ($route !== '/login') go(`/login${next}`)
    }
  })
</script>

{#if $route === '/login'}<main><Login /></main>
{:else if $route === '/authenticate'}<main><Login mode="authenticate" /></main>
{:else if $route.startsWith('/settings')}<Settings />
{:else if $route.startsWith('/chats')}<ChatPreview chatId={$route.split('/')[2] || 'latest'} />
{:else}<PageView slug={$route} />
{/if}
