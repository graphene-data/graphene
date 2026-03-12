<script lang="ts">
  // Unified error display component.
  // Accepts any error-like object with at least a `message` property.
  // Optionally shows file location, line details, and query identification.
  type ErrorLike = {
    message: string
    type?: string // error classification: 'analysis', 'database', 'server', 'compile'
    queryId?: string
    id?: string // legacy name for queryId, set by queryEngine/Chart
    file?: string
    line?: number
    column?: number
    from?: {line?: number, col?: number, lineText?: string}
    loc?: {line?: number, column?: number}
    codeFrame?: string
    frame?: string
  }

  interface Props {
    error: unknown
  }

  let {error: raw}: Props = $props()

  function normalize(raw: unknown): ErrorLike {
    if (typeof raw === 'string') return {message: raw}
    if (raw instanceof globalThis.Error) return {message: raw.message}
    if (raw && typeof raw === 'object') return raw as ErrorLike
    return {message: String(raw)}
  }

  function normalizePath(path: string) {
    return path.replace(/\\/g, '/').replace(/^file:\/\//, '')
  }

  function looksAbsolutePath(path: string) {
    return path.startsWith('/') || /^[A-Za-z]:\//.test(path)
  }

  // "/foo/bar/baz.md" → "baz.md"
  function basename(path: string) { return normalizePath(path).split('/').pop() || path }

  // Classify query errors by type for a more descriptive message prefix.
  function classifyError(e: ErrorLike) {
    if (e.type === 'analysis' || e.from || e.loc || e.codeFrame || e.frame) return `GSQL error - ${e.message || 'Unknown query error'}`
    if (e.type === 'database') return e.message ? `Database query failed: ${e.message}` : 'Database query failed'
    if (e.type === 'server') return e.message ? `Server error while running query: ${e.message}` : 'Server error while running query'
    return ''
  }

  let parsed = $derived.by(() => {
    let e = normalize(raw)
    let message = classifyError(e) || e.message || 'An unknown error occurred'
    let queryId = e.queryId || (e.id && !e.id.startsWith('/') ? e.id : undefined)
    let line = e.from?.line ?? e.loc?.line ?? e.line
    let column = e.from?.col ?? e.loc?.column ?? e.column
    let lineText = e.from?.lineText
    let pointer = Number.isFinite(column) ? `${' '.repeat(Math.max(0, (column || 1) - 1))}^` : ''
    let file = e.file && e.file !== 'input' ? basename(e.file) : undefined
    let fileLine = file ? `${file}${line ? `:${line}` : ''}` : undefined
    let absoluteFilePath = e.file ? normalizePath(e.file) : undefined

    // Svelte/Vite embeds the absolute file path in the message ("file:line:col message")
    // and at the start of the frame. Strip absolute paths so screenshots stay stable.
    if (absoluteFilePath && looksAbsolutePath(absoluteFilePath)) {
      let escapedPath = absoluteFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      message = message.replace(new RegExp(escapedPath, 'g'), file || basename(absoluteFilePath))
      if (message.startsWith(file || '')) message = message.replace(/^([^\s]+):\d+:\d+\s+/, '')
    }

    let frame = e.frame
    if (frame && absoluteFilePath && looksAbsolutePath(absoluteFilePath)) {
      let escapedPath = absoluteFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      frame = frame.replace(new RegExp(escapedPath, 'g'), file || basename(absoluteFilePath))

      // Strip leading lines that are just file paths (with optional :line suffix)
      let lines = frame.split('\n')
      while (lines.length) {
        let candidate = normalizePath(lines[0].trim())
        if (candidate === absoluteFilePath || candidate.startsWith(absoluteFilePath + ':')) {
          lines.shift()
          continue
        }
        if (looksAbsolutePath(candidate)) {
          lines.shift()
          continue
        }
        break
      }

      // Strip leftover column pointer line (just spaces and ^)
      if (lines.length && /^ +\^$/.test(lines[0])) lines.shift()
      frame = lines.join('\n')
    }
    let details: string[] = []
    if (queryId) details.push(queryId)
    if (fileLine) details.push(fileLine)
    else if (line) details.push(`Line ${line}`)
    if (lineText) { details.push(lineText); if (pointer) details.push(pointer) }
    if (e.codeFrame) details.push(e.codeFrame)
    if (frame) details.push(frame)
    return {message, details}
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
