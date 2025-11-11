<script lang="ts">
  import {onMount} from 'svelte'
  import {authClient} from '../authClient'

  onMount(() => {
    authClient().mountIdentityProvider({elementId: '#idp'})
  })
</script>

<div id="idp" style="min-height: 280px"></div>
