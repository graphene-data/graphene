<script lang="ts">
  import type {GrapheneError} from '../../lang/types.ts'

  interface Props {
    error: GrapheneError | string
  }

  let {error: raw}: Props = $props()

  let parsed = $derived.by(() => {
    let error = typeof raw === 'string' ? {message: raw} : raw
    let details: string[] = []
    let file = error.file

    // Vite compile errors can include machine-specific absolute paths.
    // In browser tests, pin this one known message to a stable fake path for screenshots.
    if (import.meta.env.VITE_TEST && error.message?.match(/Unexpected block closing tag/) && typeof file === 'string') {
      file = '/myproject/index.md'
    }

    if (error.queryId) details.push(error.queryId)
    if (file && file != 'input') {
      let line = error.from?.line != null ? error.from.line + 1 : undefined
      details.push(line ? `${file}:${line}` : file)
    }
    if (error.frame) details.push(error.frame)

    return {message: error.message || 'Unknown error', details}
  })
</script>

<div class="g-error" role="alert">
  <p class="g-error__message">{parsed.message}</p>
  {#if parsed.details.length}
    <pre class="g-error__details">{parsed.details.join('\n')}</pre>
  {/if}
</div>

<style>
  .g-error {
    padding: 16px 20px;
    margin: 12px 0;
    border-radius: 6px;
    border-left: 3px solid var(--red-500);
    background: var(--red-50);
    color: var(--red-800);
  }
  .g-error__message {
    margin: 0;
    line-height: 1.5;
  }
  .g-error__details {
    margin: 12px 0 0;
    font-family: 'JetBrains Mono', var(--monospace-font-family);
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--red-700);
  }
</style>
