<script lang="ts">
  import {onDestroy, mount, unmount} from 'svelte'

  let {chatId}: {chatId: string} = $props()

  type ChatSession = {
    id: string
    repoId: string | null
    updatedAt: string
    messages: any[]
  }

  type TimelineItem = {
    id: string
    kind: 'message' | 'tool'
    role?: string
    text?: string
    name?: string
    status?: 'pending' | 'succeeded' | 'failed'
    summary?: string | null
    error?: string | null
    renderIndex?: number
  }

  type RenderCall = {
    id: string
    markdown: string
    mdId?: string
    status: 'pending' | 'succeeded' | 'failed'
  }

  let loading = $state(true)
  let chatError = $state('')
  let previewError = $state('')
  let session = $state<ChatSession | null>(null)
  let timeline = $state<TimelineItem[]>([])
  let renders = $state<RenderCall[]>([])
  let selectedRenderId = $state('')
  let showCode = $state(false)

  let selectedRender = $derived.by(() => {
    if (!selectedRenderId) return null
    return renders.find(x => x.id === selectedRenderId) || null
  })

  let selectedTool = $derived.by(() => {
    if (!selectedRenderId) return null
    let item = timeline.find(x => x.kind === 'tool' && x.id === selectedRenderId)
    return item?.kind === 'tool' ? item : null
  })

  let selectedRenderError = $derived.by(() => {
    if (!selectedTool || selectedTool.status !== 'failed') return ''
    return selectedTool.error || 'Could not render this markdown preview.'
  })

  let previewTarget = $state<HTMLElement | undefined>(undefined)
  let previewInstance: any
  let currentChatId = $state('')
  let currentRenderId = $state('')
  let previewLoadToken = 0

  $effect(() => {
    if (!chatId || chatId === currentChatId) return
    currentChatId = chatId
    loadChat(chatId)
  })

  $effect(() => {
    if (!session || !session.repoId || !selectedRenderId || !previewTarget || selectedRenderId === currentRenderId) return
    let selected = renders.find(x => x.id === selectedRenderId)
    if (!selected) return
    currentRenderId = selectedRenderId
    if (selected.status === 'failed') {
      previewError = ''
      if (previewInstance) unmount(previewInstance)
      previewInstance = null
      return
    }
    loadPreview(selected.markdown, session.repoId)
  })

  onDestroy(() => {
    if (previewInstance) unmount(previewInstance)
  })

  async function loadChat (id: string) {
    loading = true
    chatError = ''
    previewError = ''
    session = null
    timeline = []
    renders = []
    selectedRenderId = ''
    currentRenderId = ''
    if (previewInstance) unmount(previewInstance)
    previewInstance = null

    let res = await fetch(`/_api/chats/${encodeURIComponent(id)}`)
    if (!res.ok) {
      let body = await readError(res)
      chatError = body || 'Failed to load chat session.'
      loading = false
      return
    }

    let chat = await res.json() as ChatSession
    session = chat
    let parsed = parseSession(chat.messages || [])
    timeline = parsed.timeline
    renders = parsed.renders
    selectedRenderId = renders.at(-1)?.id || ''
    loading = false
  }

  async function loadPreview (markdown: string, repoId: string) {
    let token = ++previewLoadToken
    previewError = ''
    let graphene = (window as any).$GRAPHENE
    graphene?.resetQueryEngine?.()
    if (previewInstance) unmount(previewInstance)
    previewInstance = null

    let md = encodeBase64(markdown)
    let res = await fetch(`/_api/dynamic/module?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(repoId)}`)
    if (token !== previewLoadToken) return
    if (!res.ok) {
      previewError = await readError(res) || 'Failed to render markdown preview.'
      return
    }

    let code = await res.text()
    if (token !== previewLoadToken) return
    let blob = new Blob([code], {type: 'text/javascript'})
    let url = URL.createObjectURL(blob)
    let mod = await import(/* @vite-ignore */ url)
    URL.revokeObjectURL(url)
    if (token !== previewLoadToken) return
    let target = previewTarget
    if (!target) return
    previewInstance = mount(mod.default, {target})
  }

  function parseSession (messages: any[]) {
    let nextTimeline: TimelineItem[] = []
    let nextRenders: RenderCall[] = []
    let toolIndex: Record<string, TimelineItem> = {}
    let renderByToolId: Record<string, RenderCall> = {}

    for (let [messageIndex, message] of messages.entries()) {
      let role = message.role || message.type || 'assistant'
      let chunks = normalizeChunks(message)

      for (let [chunkIndex, chunk] of chunks.entries()) {
        if (chunk.type === 'text' && typeof chunk.text === 'string') {
          nextTimeline.push({id: `msg-${messageIndex}-${chunkIndex}`, kind: 'message', role, text: chunk.text})
          continue
        }

        if (isToolCall(chunk)) {
          let toolId = chunk.toolCallId || chunk.tool_call_id || chunk.id || `tool-${messageIndex}-${chunkIndex}`
          let name = chunk.toolName || chunk.tool_name || chunk.name || 'tool'
          let input = chunk.input || {}
          let entry: TimelineItem = {
            id: toolId,
            kind: 'tool',
            name,
            status: 'pending',
            summary: summarizeToolCall(name, input),
            error: null,
          }
          nextTimeline.push(entry)
          toolIndex[toolId] = entry

          if (name === 'renderMd') {
            let render: RenderCall = {
              id: toolId,
              markdown: typeof input?.markdown === 'string' ? input.markdown : '',
              status: 'pending',
            }
            renderByToolId[toolId] = render
            nextRenders.push(render)
            entry.renderIndex = nextRenders.length - 1
          }

          continue
        }

        if (!isToolResult(chunk)) continue

        let toolId = chunk.toolCallId || chunk.tool_call_id || chunk.tool_use_id
        let output = parseToolOutput(chunk)
        let status = toolStatus(chunk, output)
        let target = toolId ? toolIndex[toolId] : undefined
        if (target) target.status = status

        let render = toolId ? renderByToolId[toolId] : undefined
        if (render) {
          render.status = status
          if (typeof output?.mdId === 'string') render.mdId = output.mdId
        }

        if (target && status === 'failed') target.error = summarizeToolError(output)
      }
    }

    return {timeline: nextTimeline, renders: nextRenders}
  }

  function normalizeChunks (message: any) {
    if (Array.isArray(message.content)) return message.content
    if (Array.isArray(message.message?.content)) return message.message.content
    if (typeof message.content === 'string') return [{type: 'text', text: message.content}]
    if (typeof message.text === 'string') return [{type: 'text', text: message.text}]
    return []
  }

  function isToolCall (chunk: any) {
    return chunk?.type === 'tool-call' || chunk?.type === 'tool_use'
  }

  function isToolResult (chunk: any) {
    return chunk?.type === 'tool-result' || chunk?.type === 'tool_result'
  }

  function parseToolOutput (chunk: any) {
    if (chunk?.output) return chunk.output
    if (typeof chunk?.content === 'string') {
      try {
        return JSON.parse(chunk.content)
      } catch {
        return {content: chunk.content}
      }
    }
    return chunk?.content || {}
  }

  function toolStatus (chunk: any, output: any): 'pending' | 'succeeded' | 'failed' {
    if (chunk?.is_error === true || chunk?.isError === true) return 'failed'
    if (output?.success === false) return 'failed'
    return 'succeeded'
  }

  function summarizeToolCall (name: string, input: any) {
    if (!input || typeof input !== 'object') return null
    if (name === 'listDir') return `list dir ${input.path || '.'}`
    if (name === 'readFile') return `read file ${input.path || ''}`
    if (name === 'search') return `search ${input.query || ''}`
    if (name === 'respondToUser') return `respond ${input.text || ''}`
    if (name === 'renderMd') {
      let firstLine = typeof input.markdown === 'string'
        ? input.markdown.split('\n').find((x: string) => x.trim().length)
        : ''
      return `render md ${firstLine || ''}`.trim()
    }
    return `${toLabel(name)} ${Object.values(input).map(value => String(value)).join(' ')}`.trim()
  }

  function summarizeToolError (output: any) {
    if (typeof output?.error === 'string' && output.error) return output.error
    if (typeof output?.message === 'string' && output.message) return output.message
    if (typeof output?.content === 'string' && output.content) return output.content
    return 'Tool call failed.'
  }

  async function readError (res: Response) {
    try {
      let body = await res.json() as {error?: string}
      return body.error || ''
    } catch {
      return ''
    }
  }

  function labelForRole (role?: string) {
    if (role === 'user') return 'User'
    if (role === 'assistant') return 'Assistant'
    return 'Message'
  }

  function toLabel (name?: string) {
    if (!name) return 'tool'
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
  }

  function encodeBase64 (value: string) {
    let bytes = new TextEncoder().encode(value)
    let binary = ''
    for (let byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
</script>

<div class="chat-preview">
  <aside class="chat-preview__steps">
    <div class="steps-list">
      {#if !timeline.length && !loading}
        <p class="state">No messages in this session.</p>
      {/if}

      {#each timeline as item, index (item.id + '-' + index)}
        {#if item.kind === 'message'}
          <article class="step step--message">
            <span class="step-kind">{labelForRole(item.role)}</span>
            <p>{item.text}</p>
          </article>
        {:else}
          <article class="step step--tool" class:step--selected={selectedRenderId === item.id}>
            <p class="tool-line">{item.summary || toLabel(item.name)}</p>
            {#if item.status === 'failed'}
              <p class="tool-error">{item.error || 'Tool call failed.'}</p>
            {/if}
            {#if item.name === 'renderMd'}
              <button
                class="preview-button"
                data-render-index={item.renderIndex}
                onclick={() => { selectedRenderId = item.id }}
              >
                Show in preview
              </button>
            {/if}
          </article>
        {/if}
      {/each}
    </div>
  </aside>

  <main class="chat-preview__main">
    {#if loading}
      <p class="state">Loading session…</p>
    {:else if chatError}
      <p class="state state--error">{chatError}</p>
    {:else if !renders.length}
      <p class="state">No renderMd calls found in this session.</p>
    {:else}
      <div class="preview-frame">
        {#if previewError}
          <p class="state state--error">{previewError}</p>
        {/if}
        {#if selectedRenderError}
          <section class="render-error">
            <p class="render-error__message">{selectedRenderError}</p>
          </section>
        {/if}
        <div bind:this={previewTarget}></div>
        {#if selectedRender}
          <section class="code-panel">
            <button class="code-toggle" onclick={() => { showCode = !showCode }}>
              <span class="code-arrow" class:code-arrow--open={showCode}>▸</span>
              {showCode ? 'Hide code' : 'Show code'}
            </button>
            {#if showCode}
              <pre class="code-block"><code>{selectedRender.markdown}</code></pre>
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .chat-preview {
    display: grid;
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
    gap: 0;
    height: 100vh;
    overflow: hidden;
    width: 100%;
    background: #fff;
  }

  .chat-preview__steps {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .chat-preview__main {
    min-width: 0;
    min-height: 0;
    padding: 24px 28px;
    overflow: auto;
    border-left: 1px solid #e2e8f0;
  }

  .preview-frame {
    padding: 0;
    min-height: 360px;
  }

  .code-panel {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid #e2e8f0;
  }

  .code-toggle {
    border: none;
    background: transparent;
    color: #0f172a;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .code-arrow {
    font-size: 11px;
    color: #64748b;
    transform: rotate(0deg);
    transition: transform 120ms ease;
  }

  .code-arrow--open {
    transform: rotate(90deg);
  }

  .code-block {
    margin: 10px 0 0;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 12px;
    line-height: 1.45;
    overflow-x: auto;
    white-space: pre;
  }

  .code-block code {
    display: block;
    background: transparent;
    border: 0;
    color: inherit;
    padding: 0;
    border-radius: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .steps-list {
    padding: 0;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #f8fafc;
  }

  .step {
    border-bottom: 1px solid #e2e8f0;
    padding: 11px 16px;
    background: #fff;
  }

  .step--selected {
    background: #eff6ff;
    box-shadow: inset 3px 0 0 #2563eb;
  }

  .step-kind {
    font-size: 11px;
    color: #475569;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .step p {
    margin: 6px 0 0;
    font-size: 13px;
    color: #0f172a;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .tool-line {
    margin: 0;
    font-size: 13px;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .step:last-child {
    border-bottom: none;
  }

  .tool-error {
    color: #b91c1c;
    margin-top: 6px;
    white-space: pre-wrap;
  }

  .preview-button {
    margin-top: 8px;
    border: none;
    background: transparent;
    color: #1d4ed8;
    border-radius: 0;
    padding: 0;
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .preview-button:hover {
    color: #1e40af;
  }

  .state {
    color: #64748b;
    margin: 0;
  }

  .state--error {
    color: #b91c1c;
  }

  .render-error {
    margin: 0 0 14px;
    padding: 12px 14px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    border-radius: 8px;
  }

  .render-error__message {
    margin: 6px 0 0;
    font-size: 18px;
    line-height: 1.35;
    color: #b91c1c;
  }

  @media (max-width: 980px) {
    .chat-preview {
      grid-template-columns: 1fr;
      height: auto;
      min-height: 100vh;
      overflow: visible;
    }

    .chat-preview__steps {
      width: 100%;
      min-height: 240px;
      max-height: 48vh;
    }

    .chat-preview__main {
      border-left: none;
      border-top: 1px solid #e2e8f0;
      padding: 20px;
    }
  }
</style>
