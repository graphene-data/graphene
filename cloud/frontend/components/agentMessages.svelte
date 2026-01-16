<script>
  import {afterUpdate, beforeUpdate, onMount} from 'svelte'
  import {marked} from 'marked'
  import DOMPurify from 'dompurify'

  export let messages = []

  let grapheneRoot = typeof window !== 'undefined' && window.grapheneRoot ? window.grapheneRoot : ''
  let container
  let stickToBottom = true
  const BOTTOM_BUFFER = 40

  // Marked produces HTML from markdown; DOMPurify keeps it safe for injection.
  const sanitizeHtml = typeof window === 'undefined' ? (html) => html : (html) => DOMPurify.sanitize(html)

  function renderMarkdown (source) {
    if (!source) return ''
    let html = marked.parse(source, {mangle: false, headerIds: false})
    return sanitizeHtml(html)
  }

  $: displayMessages = buildDisplayMessages(messages)

  function buildDisplayMessages (source) {
    grapheneRoot = findGrapheneRoot(source) || grapheneRoot
    let combined = []
    let toolIndex = new Map()

    for (let message of source) {
      if (message.type === 'system' && message.cwd) grapheneRoot = message.cwd
      if (message.type === 'assistant' && message.message?.content) {
        for (let chunk of message.message.content) {
          if (chunk.type === 'text') {
            combined.push({
              kind: 'assistant-text',
              id: chunk.id ?? `${message.uuid || message.message?.id}-text-${combined.length}`,
              text: chunk.text,
            })
          } else if (chunk.type === 'tool_use') {
            let entry = {
              kind: 'tool',
              id: chunk.id,
              name: chunk.name,
              inputSummary: formatToolInput(chunk.name, chunk.input),
              status: 'pending',
            }
            toolIndex.set(chunk.id, entry)
            combined.push(entry)
          }
        }
      }

      if (message.type === 'user' && message.message?.content) {
        for (let chunk of message.message.content) {
          if (chunk.type !== 'tool_result') continue
          let target = toolIndex.get(chunk.tool_use_id)
          let status = toolResultStatus(chunk)
          if (target) {
            target.status = status
          } else {
            combined.push({
              kind: 'tool',
              id: chunk.tool_use_id,
              name: 'Tool',
              inputSummary: null,
              status,
            })
          }
        }
      }
    }

    return combined
  }

  function findGrapheneRoot (list) {
    let systemMsg = [...list].reverse().find(item => item.type === 'system' && item.cwd)
    return systemMsg?.cwd
  }

  function toolResultStatus (result) {
    if (result?.is_error === true || result?.isError === true) return 'failed'
    if (typeof result?.content === 'string' && /error/i.test(result.content)) return 'failed'
    return 'succeeded'
  }

  function stripRoot (value) {
    if (!grapheneRoot || typeof value !== 'string') return value
    let normalizedRoot = grapheneRoot.endsWith('/') ? grapheneRoot : grapheneRoot + '/'
    return value.startsWith(normalizedRoot) ? value.slice(normalizedRoot.length) : value
  }

  function summarizeObject (obj) {
    if (!obj || typeof obj !== 'object') return null
    let parts = []
    for (let [key, val] of Object.entries(obj)) {
      let formatted = formatValue(val)
      if (formatted) parts.push(`${key}: ${formatted}`)
    }
    return parts.join(' · ')
  }

  function formatValue (val) {
    if (val == null) return ''
    if (typeof val === 'string') return stripRoot(val)
    if (typeof val === 'number' || typeof val === 'boolean') return String(val)
    if (Array.isArray(val)) return val.map(formatValue).join(', ')
    if (typeof val === 'object') return summarizeObject(val)
    return ''
  }

  function formatToolInput (name, input) {
    if (!input) return null
    if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) return null
    if (typeof input === 'string') return stripRoot(input)
    let summary = summarizeObject(input)
    return summary || null
  }

  function nearBottom () {
    if (!container) return true
    return container.scrollHeight - container.clientHeight - container.scrollTop <= BOTTOM_BUFFER
  }

  function handleScroll () {
    stickToBottom = nearBottom()
  }

  onMount(() => {
    if (container) container.scrollTop = container.scrollHeight
    handleScroll()
  })

  beforeUpdate(() => {
    handleScroll()
  })

  afterUpdate(() => {
    if (!container) return
    if (stickToBottom) container.scrollTop = container.scrollHeight
    handleScroll()
  })
</script>

<!-- eslint-disable svelte/no-at-html-tags -->

<style>
  .messages-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow-y: auto;
    padding: 4px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
  }

  .messages-container::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 999px;
  }

  .message {
    padding: 12px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    color: #334155;
    line-height: 1.55;
  }

  .message-text {
    margin: 0;
  }

  .message-text :global(p) {
    margin: 0 0 0.6rem;
    line-height: 1.6;
  }

  .message-text :global(p:last-child) {
    margin-bottom: 0;
  }

  .message-text :global(a) {
    color: #2563eb;
    text-decoration: none;
  }

  .message-text :global(a:hover) {
    text-decoration: underline;
  }

  .message-text :global(code) {
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    background: rgba(148, 163, 184, 0.16);
    padding: 0 4px;
    border-radius: 4px;
  }

  .message-text :global(pre) {
    background: rgba(15, 23, 42, 0.04);
    padding: 12px;
    border-radius: 8px;
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    overflow-x: auto;
  }

  .message-assistant {
    color: #1e293b;
  }

  .message-tool {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #1e293b;
  }

  .tool-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .tool-name {
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #475569;
    font-size: 12px;
  }

  .tool-status {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #2563eb;
  }

  .tool-status.failed {
    color: #dc2626;
  }

  .tool-status.pending {
    color: #64748b;
  }

  .tool-input {
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    color: #64748b;
    word-break: break-word;
  }

  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 32px 16px;
    font-style: italic;
  }

  .message:last-child {
    border-bottom: none;
  }
</style>

<div class="messages-container" bind:this={container} on:scroll={handleScroll}>
  {#each displayMessages as item (item.id)}
    {#if item.kind === 'assistant-text'}
      <div class="message message-assistant">
        <div class="message-text markdown">
          {@html renderMarkdown(item.text)}
        </div>
      </div>
    {:else if item.kind === 'tool'}
      <div class="message message-tool">
        <div class="tool-meta">
          <span class="tool-name">{item.name}</span>
          <span class={`tool-status ${item.status}`}>
            {#if item.status === 'failed'}
              Failed
            {:else if item.status === 'pending'}
              Running…
            {:else}
              Succeeded
            {/if}
          </span>
        </div>
        {#if item.inputSummary}
          <div class="tool-input">{item.inputSummary}</div>
        {/if}
      </div>
    {/if}
  {/each}
</div>
