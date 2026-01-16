<script lang="ts">
  import {onMount} from 'svelte'
  import {go} from '../router.ts'
  import {authClient, session, AuthFlowType, StytchEventType} from '../authClient.ts'

  export let mode: 'login' | 'authenticate' = 'login'

  onMount(() => {
    let stytch = authClient()

    if (mode === 'authenticate') {
      stytch.mountIdentityProvider({elementId: '#stytch-login'})
    } else {
      stytch.mount({
        elementId: '#stytch-login',
        callbacks: {
          onEvent: e => {
            if (e.type == StytchEventType.AuthenticateFlowComplete) {
              let stytchSession = stytch.session.getSync()
              session.set(stytchSession)

              let orgSlug = stytchSession?.organization_slug
              let url = new URL(window.location.href)
              let next = url.searchParams.get('next') || '/'

              if (orgSlug && !window.location.hostname.includes('localhost')) {
                window.location.href = `https://${orgSlug}.graphenedata.com${next}`
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
          passwordOptions: {},
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
