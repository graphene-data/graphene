<script lang="ts">
  import {session} from './authClient.ts'
  import Login from './routes/Login.svelte'
  import PageView from './routes/PageView.svelte'
  import Settings from './routes/Settings.svelte'
  import ChatPreview from './routes/ChatPreview.svelte'
  import DynamicView from './routes/DynamicView.svelte'
  import {route, go} from './router.ts'

  $effect(() => {
    let isLoginRoute = $route === '/login' || $route === '/authenticate'
    let isDynamicRoute = $route === '/dynamic'
    let hasAgentToken = document.cookie.includes('graphene_agent_token=')

    if ($session || isLoginRoute) return // if you're logged in or logging in, allow you to continue
    if (isDynamicRoute && hasAgentToken) return // if this is a bot load a dynamic page, dont check auth

    // otherwise, you're trying to view a page but you aren't logged in. Capture the path you wanted,
    // then redirect to the login page
    let {pathname, search} = window.location
    if (pathname != '/' || search) {
      go(`/login?next=${encodeURIComponent(pathname + search)}`)
    } else {
      go('/login')
    }
  })
</script>

{#if $route === '/login'}<main><Login /></main>
{:else if $route === '/authenticate'}<main><Login /></main>
{:else if $route === '/dynamic'}<DynamicView />
{:else if $route.startsWith('/settings')}<Settings />
{:else if $route.startsWith('/chats')}<ChatPreview chatId={$route.split('/')[2] || 'latest'} />
{:else}<PageView slug={$route} />
{/if}
