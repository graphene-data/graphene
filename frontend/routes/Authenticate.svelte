<script lang="ts">
  import {onMount} from 'svelte'
  import {authClient} from '../authClient.ts'

  onMount(() => {
    authClient().mountIdentityProvider({elementId: '#idp'})
  })
</script>

<section class="auth-screen">
  <div id="idp" class="auth-shell"></div>
</section>

<style>
  .auth-screen {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .auth-shell {
    min-height: 340px;
    width: 100%;
    max-width: 420px;
    align-items: center;
  }
</style>
