<script>
  let {error} = $props()
</script>

<h1>Error loading page</h1>
<p class="message">{error.message}</p>
{#if error.frame}<pre>{error.frame}</pre>{/if}
{#if error.file}<p class="file">{error.file}</p>{/if}

<style>
  h1 { margin-top: 0; }
  .message { color: var(--red-700); }
  pre {
    background: var(--grey-100);
    border: 1px solid var(--grey-200);
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .file { color: var(--grey-500); font-size: 0.875rem; }
</style>
