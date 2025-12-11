<script lang="ts">
  import {onMount} from 'svelte'
  import {go} from '../router.ts'
  import {authClient, session, AuthFlowType, StytchEventType} from '../authClient.ts'

  // This uses Stytch's built-in UI.
  // It's smart enough to load the right state based on url params, so having all redirectURLs point to `<origin>/login` is sufficient.

  onMount(() => {
    let stytch = authClient()

    stytch.mount({
      elementId: '#stytch-login',
      callbacks: {
        onEvent: e => {
          if (e.type == StytchEventType.AuthenticateFlowComplete) {
            let url = new URL(window.location.href)
            session.set(stytch.session.getSync())
            go(url.searchParams.get('next') || '/')
          }
        },
      },
      config: {
        authFlowType: AuthFlowType.Discovery,
        sessionOptions: {sessionDurationMinutes: 60 * 24 * 30},
        products: ['passwords'],
        // passwordOptions: {
        //   loginRedirectURL: 'http://localhost:3000/_api/authenticate',
        //   resetPasswordRedirectURL: 'http://localhost:3000/login',
        // },
      },
    })
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
