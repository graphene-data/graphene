<script>
  import {onMount} from 'svelte'
  import AgentMessages from './internal/agentMessages.svelte'

  let messages = []
  let prompt = ''
  let content


  async function updateContent(fileName) {
    try {
      let mod = await import(`${fileName}?import` /* @vite-ignore */)
      content = mod.default
    } catch (e) {
      throw e
    }
  }

  async function startPrompt(prompt) {
    if (!prompt.trim()) return
    messages = []

    let response = await fetch("/graphene/agent", {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt}),
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
      console.log(buffer)
      let lines = buffer.split('\n')
      buffer = lines.pop() // Keep incomplete line in buffer

      for (let line of lines) {
        if (!line.trim()) continue
        messages = [...messages, JSON.parse(line)]
      }
    }

    let lastWrite = messages.find(m => m.message?.content[0]?.name == 'Write')
    updateContent(lastWrite?.message.content[0].input.file_path)
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      startPrompt(prompt)
      prompt = ''
    }
  }

  onMount(() => {
    // Focus the textarea
    document.querySelector('textarea')?.focus()
    // updateContent('flight-delays-by-carrier.md')
  })
</script>

<style>
  .explore {
    display: flex;
    height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .left-panel {
    width: 400px;
    padding-top: 20px;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  main {
    flex: 1;
    padding: 20px;
    overflow: hidden;
  }

  h1 {
    margin: 0 0 20px 0;
    color: #1f2937;
  }

  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .empty-content {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    text-align: center;
  }

  .empty-content h2 {
    color: #1f2937;
    margin-bottom: 12px;
  }

  .empty-content p {
    max-width: 400px;
    line-height: 1.6;
  }
</style>

<div class="explore">
  <div class="left-panel">
    <h1>Explore</h1>
    <textarea bind:value={prompt} on:keypress={handleKeyPress} />
    <AgentMessages messages={messages} />
  </div>

  <main>
    {#if content}
      <svelte:component this={content} />
    {:else}
      <div class="empty-content">
        <h2>Welcome to Graphene Explore</h2>
        <p>
          Ask a question in the text area to get started.
          I'll analyze your data and create visualizations for you.
        </p>
      </div>
    {/if}
  </main>
</div>
