<script>
  export let messages = []

  function formatToolName(toolName) {
    return toolName.charAt(0).toUpperCase() + toolName.slice(1)
  }

  function formatToolInput(input) {
    if (typeof input === 'string') return input
    if (input.file_path) return input.file_path
    if (input.pattern) return `"${input.pattern}"`
    if (input.command) return input.command
    return JSON.stringify(input, null, 2)
  }
</script>

<style>
  .messages-container {
    overflow-x: hidden;
  }

  .message {
    margin-bottom: 12px;
  }

  .message-assistant {
    padding: 12px;
    background: white;
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
  }

  .message-tool {
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 6px;
    font-family: monospace;
    font-size: 13px;
    color: #0369a1;
    border-left: 3px solid #0ea5e9;
  }

  .message-tool-result {
    padding: 8px 12px;
    background: #f0fdf4;
    border-radius: 6px;
    font-family: monospace;
    font-size: 13px;
    color: #166534;
    border-left: 3px solid #22c55e;
    white-space: pre-wrap;
  }

  .message-text {
    color: #1f2937;
    line-height: 1.5;
  }

  .tool-name {
    font-weight: 600;
    color: #0369a1;
  }

  .tool-input {
    color: #6b7280;
    font-size: 12px;
    margin-top: 4px;
  }

  .message-timestamp {
    font-size: 11px;
    color: #6b7280;
    margin-top: 8px;
  }

  .empty-state {
    text-align: center;
    color: #6b7280;
    padding: 40px 20px;
    font-style: italic;
  }
</style>

<div class="messages-container">
  {#each messages as message}
    {#if message.type === 'assistant' && message.message?.content}
      {#each message.message.content as content}
        {#if content.type === 'text'}
          <div class="message message-assistant">
            <div class="message-text">{content.text}</div>
          </div>
        {:else if content.type === 'tool_use'}
          <div class="message message-tool">
            <span class="tool-name">{formatToolName(content.name)}</span>
            <div class="tool-input">{formatToolInput(content.input)}</div>
          </div>
        {/if}
      {/each}
    {:else if message.type === 'user' && message.message?.content}
      {#each message.message.content as content}
        {#if content.type === 'tool_result'}
          <div class="message message-tool-result">
            {content.content.length > 200
              ? content.content.substring(0, 200) + '...'
              : content.content}
          </div>
        {/if}
      {/each}
    {/if}
  {/each}
</div>
