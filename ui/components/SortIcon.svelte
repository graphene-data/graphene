<script lang="ts">
  interface Props {
    ascending?: boolean
  }

  let {ascending = undefined}: Props = $props()
</script>

<svg
  class="sort-icon"
  viewBox="0 0 16 16"
  aria-hidden="true"
>
  {#if ascending}
    <path
      d="M8 5.2 3.2 10a.75.75 0 0 0 1.06 1.06L8 7.32l3.74 3.74a.75.75 0 1 0 1.06-1.06Z"
      fill="currentColor"
      fill-rule="evenodd"
    />
  {:else}
    <path
      d="M8 10.8 12.8 6a.75.75 0 0 0-1.06-1.06L8 8.68 4.26 4.94A.75.75 0 0 0 3.2 6Z"
      fill="currentColor"
      fill-rule="evenodd"
    />
  {/if}
</svg>

<style>
  .sort-icon {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-bottom: 2px;
  }
</style>
