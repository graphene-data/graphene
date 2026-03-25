<script lang="ts">
  import {onMount} from 'svelte'
  import {go} from '../router.ts'
  import {authClient, session, AuthFlowType, loginUrl, baseDomain} from '../authClient.ts'

  let container: HTMLElement
  let stytch = authClient()
  let url = new URL(window.location.href)
  let isAuth = url.pathname === '/authenticate'
  let isPkceFlow = isAuth &&
    url.searchParams.has('client_id') &&
    url.searchParams.has('redirect_uri') &&
    (url.searchParams.has('code_challenge') || url.searchParams.get('response_type') === 'code')

  onMount(() => {
    // If you're trying to cli/mcp auth, but you're not logged in, you need to do that first
    if (isPkceFlow && !$session) mountLoginFlow()

    // if this is an auth flow, mount the auth componenent
    else if (isAuth) mountIdentityFlow()

    // otherwise, mount login
    else mountLoginFlow()
  })

  function mountIdentityFlow() {
    // eslint-disable-next-line svelte/no-dom-manipulating
    container.replaceChildren()
    stytch.mountIdentityProvider({elementId: '#stytch-login'})
  }

  function mountLoginFlow() {
    // eslint-disable-next-line svelte/no-dom-manipulating
    container.replaceChildren()

    stytch.mount({
      elementId: '#stytch-login',
      callbacks: {
        onEvent: onLoginEvent,
      },
      config: {
        authFlowType: AuthFlowType.Discovery,
        sessionOptions: {sessionDurationMinutes: 60 * 24 * 30},
        products: ['passwords'],
        passwordOptions: {resetPasswordRedirectURL: loginUrl},
        // Auto-login if user is only a member of one organization
        directLoginForSingleMembership: {
          status: true,
          ignoreInvites: true,
          ignoreJitProvisioning: true,
        },
      },
    })
  }

  function onLoginEvent() {
    let newSession = stytch.session.getSync()
    if (!newSession) return
    session.set(newSession)

    if (newSession && isPkceFlow) {
      // if you're doing pkce, after login you still need to auth the client
      mountIdentityFlow()
    } else {
      // otherwise, go to the `next` url if present, otherwise the homepage
      let orgSlug = newSession.organization_slug
      let next = url.searchParams.get('next') || '/'

      // make sure the `next` url points to the right subdomain.
      // The exception is localhost dev, where the org technically has a slug but we dont use it.
      if (orgSlug && !window.location.hostname.includes('localhost')) {
        next = `https://${orgSlug}.${baseDomain}${next}`
      }

      go(next)
    }
  }
</script>

<section class="login-screen">
  <div bind:this={container} id="stytch-login" class="login-shell"></div>
</section>

<style>
  .login-screen {
    width: 100%;
    display: flex;
    justify-content: center;
    padding-top: 120px;
  }

  .login-shell {
    min-height: 340px;
    width: 100%;
    max-width: 420px;
  }

  /* Force our app font so Stytch UI renders the same across local/CI OS font stacks. */
  :global(#stytch-login),
  :global(#stytch-login *) {
    font-family: 'Inter', var(--ui-font-family) !important;
    font-synthesis: none;
  }

  :global(#stytch-login [data-testid='stytch-footer']),
  :global(#stytch-login [class*='powered-by']),
  :global(#stytch-login a[href*='stytch.com']) {
    display: none !important;
  }

  @media (max-width: 720px) {
    .login-shell {
      max-width: 100%;
    }
  }
</style>
