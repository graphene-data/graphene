<script lang="ts">
  type GrapheneError = {
    type?: string
    id?: string
    file?: string
    message?: string
    stack?: string
    from?: {line?: number, col?: number, lineText?: string}
    loc?: {line?: number, column?: number}
    line?: number
    column?: number
    codeFrame?: string
    frame?: string
  }

  interface Props {
    error: unknown
    title?: string
    height?: number
  }

  let {error, title: _title, height = 200}: Props = $props()

  function parseError (raw: unknown): GrapheneError {
    if (raw instanceof Error) return {message: raw.message, stack: raw.stack}
    if (typeof raw === 'string') return {message: raw}
    if (raw && typeof raw === 'object') return raw as GrapheneError
    return {message: String(raw)}
  }

  function lineDetails (e: GrapheneError) {
    let line = e.from?.line ?? e.loc?.line ?? e.line
    let column = e.from?.col ?? e.loc?.column ?? e.column
    let lineText = e.from?.lineText
    let pointer = Number.isFinite(column) ? `${' '.repeat(Math.max(0, (column || 1) - 1))}^` : ''
    return {line, lineText, pointer}
  }

  function classifyError (e: GrapheneError) {
    if (e.type === 'analysis' || e.from || e.loc || e.codeFrame || e.frame) return `GSQL error - ${e.message || 'Unknown query error'}`
    if (e.type === 'database') return 'Database query failed'
    if (e.type === 'server') return 'Server error while running query'
    return 'Query failed'
  }

  let parsed = $derived.by(() => {
    let e = parseError(error)
    let heading = classifyError(e)
    let message = e.message || 'An unknown error occurred'
    let details: string[] = []
    let line = lineDetails(e)
    // Query errors can be analyzed from generated wrapper gsql (`table <name> as (...)`).
    // When that happens, line numbers are often for synthetic sql and can be misleading,
    // but the captured source line text and caret are still accurate and useful to users.
    // So we show file + line only when the diagnostic has a reliable line.
    let fileLine = e.file && e.file !== 'input' ? `${e.file}${line.line ? `:${line.line}` : ''}` : undefined

    if (e.id) details.push(e.id)
    if (fileLine) details.push(fileLine)
    else if (line.line) details.push(`Line ${line.line}`)
    if (line.lineText) details.push(line.lineText)
    if (line.pointer) details.push(line.pointer)
    if (e.codeFrame) details.push(e.codeFrame)
    if (e.frame) details.push(e.frame)

    if (heading.startsWith('GSQL error - ')) message = ''
    return {heading, message, details}
  })
</script>

<div class="error-chart" style={`min-height:${height}px`} role="alert">
  <div class="error-chart__heading">{parsed.heading}</div>
  {#if parsed.message}
    <div class="error-chart__message">{parsed.message}</div>
  {/if}
  {#if parsed.details.length}
    <pre class="error-chart__details">{parsed.details.join('\n')}</pre>
  {/if}
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

  .error-chart__heading {
    font-weight: 700;
    margin-bottom: 4px;
    text-align: center;
  }

  .error-chart__message {
    margin: 0;
    text-align: center;
    max-width: 72ch;
    line-height: 1.4;
  }

  .error-chart__details {
    margin: 10px 0 0;
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 100%;
    color: inherit;
    background: transparent;
  }
</style>
