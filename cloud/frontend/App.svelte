<script lang="ts">
  import {session} from './authClient.ts'
  import Login from './routes/Login.svelte'
  import PageView from './routes/PageView.svelte'
  import Settings from './routes/Settings.svelte'
  import ChatPreview from './routes/ChatPreview.svelte'
  import DynamicView from './routes/DynamicView.svelte'
  import {route, go} from './router.ts'

  $effect(() => {
    let isLoginRoute = $route === '/login'
    let isDynamicRoute = $route === '/dynamic'
    let hasAgentToken = document.cookie.includes('graphene_agent_token=')

    if ($session || isLoginRoute) return
    if (isDynamicRoute && hasAgentToken) return
    let {pathname, search} = window.location

    if (pathname != '/' || search) {
      go(`/login?next=${encodeURIComponent(pathname + search)}`)
    } else {
      go('/login')
    }
  })
</script>

{#if $route === '/login'}<main><Login /></main>
{:else if $route === '/authenticate'}<main><Login mode="authenticate" /></main>
{:else if $route === '/dynamic'}<DynamicView />
{:else if $route.startsWith('/settings')}<Settings />
{:else if $route.startsWith('/chats')}<ChatPreview chatId={$route.split('/')[2] || 'latest'} />
{:else}<PageView slug={$route} />
{/if}
