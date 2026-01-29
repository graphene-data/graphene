<script lang="ts">
  interface Props {
    error: unknown
    title: string
    height?: number
  }

  let {error, title, height = 200}: Props = $props()

  let message = $derived((() => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  })())
</script>

<div class="error-chart" style={`min-height:${height}px`} role="alert">
  <div class="error-chart__title">{title}</div>
  <pre class="error-chart__message">{message}</pre>
</div>

<style>
  .error-chart {
    width: 100%;
    display: grid;
    place-items: center;
    padding: 16px;
    margin: 12px 0;
    border-radius: 6px;
    border: 1px solid rgba(220, 38, 38, 0.4);
    background: rgba(254, 226, 226, 0.7);
    color: #991b1b;
    box-sizing: border-box;
  }

  .error-chart__title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 8px;
  }

  .error-chart__message {
    margin: 0;
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 100%;
    color: inherit;
    background: transparent;
  }
</style>
