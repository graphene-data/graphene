<script>
  import {onMount} from 'svelte'
  import AgentMessages from './internal/agentMessages.svelte'

  let messages = []
  let prompt = ''
  let content
  let promptField

  async function updateContent (fileName) {
    if (!fileName) return
    let mod = await import(/* @vite-ignore */ `${fileName}?import`)
    content = mod.default
  }

  async function startPrompt (promptText) {
    if (!promptText.trim()) return
    messages = []

    let response = await fetch('/graphene/agent', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt: promptText}),
    })

    if (!response.ok) {
      console.error('Agent request failed:', response.statusText)
      return
    }

    let reader = response.body.getReader()
    let decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      let {done, value} = await reader.read()
      if (done) break

      buffer += decoder.decode(value, {stream: true})
      let lines = buffer.split('\n')
      buffer = lines.pop()

      for (let line of lines) {
        if (!line.trim()) continue
        messages = [...messages, JSON.parse(line)]
      }
    }

    let base = messages.find(item => item.type === 'system')?.cwd || ''

    let lastWrite = messages.find(m => m.message?.content[0]?.name == 'Write')
    updateContent(lastWrite?.message.content[0].input.file_path.replace(base, ''))
  }

  function submitPrompt () {
    let trimmed = prompt.trim()
    if (!trimmed) return
    startPrompt(trimmed)
    prompt = ''
    autosizePrompt()
  }

  function handleKeyDown (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitPrompt()
    }
  }

  function autosizePrompt () {
    if (!promptField) return
    promptField.style.height = 'auto'
    promptField.style.height = `${promptField.scrollHeight}px`
  }

  function handlePromptInput () {
    autosizePrompt()
  }

  onMount(() => {
    promptField?.focus()
    autosizePrompt()
  })
</script>

<style>
  .explore {
    display: flex;
    height: 100vh;
    background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0f172a;
  }

  .sidebar {
    --sidebar-inline-padding: 28px;
    width: 340px;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 28px;
    padding: 32px var(--sidebar-inline-padding) 28px var(--sidebar-inline-padding);
    border-right: 1px solid rgba(148, 163, 184, 0.12);
    background: transparent;
    height: 100vh;
    box-sizing: border-box;
    overflow: hidden;
  }

  .prompt {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .prompt__field {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(255, 255, 255, 0.82);
  }

  textarea {
    flex: 1;
    min-height: 80px;
    padding: 18px 18px 18px;
    border: none;
    border-radius: 16px;
    background: transparent;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.55;
    resize: none;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  textarea::placeholder {
    color: #94a3b8;
  }

  textarea:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.95);
  }

  .prompt__field:focus-within {
    border-color: rgba(37, 99, 235, 0.32);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18);
    background: rgba(255, 255, 255, 0.95);
  }

  .prompt__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid rgba(148, 163, 184, 0.16);
  }

  .prompt__hint {
    font-size: 12px;
    color: #94a3b8;
  }

  .prompt__run {
    padding: 8px 16px;
    border-radius: 999px;
    border: none;
    background: #1d4ed8;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .prompt__run:hover {
    box-shadow: 0 8px 18px -12px rgba(37, 99, 235, 0.8);
  }

  .prompt__run:active {
    transform: translateY(1px);
  }

  .sidebar__messages {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .messages-panel {
    flex: 1;
    margin-right: calc(-1 * var(--sidebar-inline-padding, 0px));
    overflow: hidden;
    display: flex;
  }

  .messages-panel :global(.messages-container) {
    flex: 1;
    height: 100%;
  }

  .messages-panel :global(.message) {
    padding-right: var(--sidebar-inline-padding, 0px);
  }

  .workspace {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    height: 100vh;
    box-sizing: border-box;
    background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 45%),
      radial-gradient(circle at bottom left, rgba(14, 116, 144, 0.08), transparent 40%);
  }

  .workspace__content,
  .workspace__empty {
    flex: 1;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 32px 80px -48px rgba(15, 23, 42, 0.35);
    padding: 36px 40px;
    overflow: auto;
  }

  .workspace__empty {
    display: flex;
    flex-direction: column;
    gap: 16px;
    justify-content: center;
    max-width: 520px;
    color: #475569;
  }

  .workspace__empty h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    color: #0f172a;
  }

  .workspace__empty p {
    margin: 0;
    line-height: 1.7;
  }

</style>

<div class="explore">
  <aside class="sidebar">
    <section class="sidebar__messages">
      <div class="messages-panel">
        <AgentMessages messages={messages} />
      </div>
    </section>

    <form class="prompt" on:submit|preventDefault={submitPrompt}>
      <div class="prompt__field">
        <textarea
          bind:this={promptField}
          bind:value={prompt}
          on:input={handlePromptInput}
          on:keydown={handleKeyDown}
        />
        <div class="prompt__footer">
          <span class="prompt__hint"></span>
          <button type="submit" class="prompt__run">Run</button>
        </div>
      </div>
    </form>
  </aside>

  <main class="workspace">
    {#if content}
      <div class="workspace__content">
        <svelte:component this={content} />
      </div>
    {:else}
      <div class="workspace__empty">
        <h2>Graphene Explore</h2>
        <p>
          Ask a question or type a query.
        </p>
      </div>
    {/if}
  </main>
</div>
