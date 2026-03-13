<script lang="ts">
  import {onMount} from 'svelte'
  import {go} from '../router.ts'
  import {authClient, session, AuthFlowType, StytchEventType, loginUrl, baseDomain} from '../authClient.ts'

  let {mode = 'login'}: {mode?: 'login' | 'authenticate'} = $props()

  onMount(() => {
    let stytch = authClient()

    if (mode === 'authenticate') {
      stytch.mountIdentityProvider({elementId: '#stytch-login'})
    } else {
      let url = new URL(window.location.href)

      stytch.mount({
        elementId: '#stytch-login',
        callbacks: {
          onEvent: e => {
            if (e.type == StytchEventType.AuthenticateFlowComplete) {
              let stytchSession = stytch.session.getSync()
              session.set(stytchSession)

              let orgSlug = stytchSession?.organization_slug
              let next = url.searchParams.get('next') || '/'

              if (orgSlug && !window.location.hostname.includes('localhost')) {
                window.location.href = `https://${orgSlug}.${baseDomain}${next}`
              } else {
                go(next)
              }
            }
          },
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
  })
</script>

<section class="login-screen">
  <div id="stytch-login" class="login-shell"></div>
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
