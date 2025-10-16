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

<section class="login">
  <div id="stytch-login" class="login-shell"></div>
</section>

<style>
  .login {
    background: rgba(255, 255, 255, 0.05);
    padding: 32px;
    border-radius: 20px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: rgba(255, 255, 255, 0.75);
  }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 83, 83, 0.12);
    border: 1px solid rgba(255, 83, 83, 0.35);
  }

  .login-shell {
    min-height: 340px;
  }

  @media (max-width: 720px) {
    .login {
      padding: 24px;
    }
  }
</style>
