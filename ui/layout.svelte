<script>
  let isExplore = window.location.pathname.match(/\/explore(\?|$)/)
</script>

{#if isExplore}
  <slot />
{:else}
  <main>
    <slot />
  </main>
{/if}
