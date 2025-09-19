<script>
  export let data
  $: ready = true
</script>

<div data-stub="BarChart">
  {#if ready}
    <svg width="100" height="50"></svg>
  {/if}
</div>

