<script lang="ts">
  import {onMount} from 'svelte'
  import {go} from '../router'
  import {createAuthClient, AuthFlowType, StytchEventType} from '../authClient'

  onMount(() => {
    let stytch = createAuthClient()

    stytch.mount({
      elementId: '#stytch-login',
      callbacks: {
        onEvent: e => {
          if (e.type == StytchEventType.AuthenticateFlowComplete) {
            go('/')
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
