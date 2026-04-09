<script lang="ts">
  import {onMount} from 'svelte'

  let styleVars = [
    '--prose-font-family',
    '--ui-font-family',
    '--monospace-font-family',
    '--color-background',
    '--color-heading',
    '--color-content',
    '--color-muted',
    '--color-border',
    '--color-link',
  ]

  let styleRows = $state([] as Array<{name: string, value: string}>)

  let sampleNodes = {} as Record<string, HTMLElement>

  let readCssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '(empty)'

  let refreshRows = () => {
    styleRows = styleVars.map(name => ({name, value: readCssVar(name)}))
  }

  let registerSample = (node: HTMLElement) => {
    let key = node.dataset.styleDemo
    if (!key) return

    sampleNodes[key] = node
    refreshRows()

    return {
      destroy: () => {
        delete sampleNodes[key]
      },
    }
  }

  onMount(() => {
    refreshRows()

    let cssObserver = new MutationObserver(() => refreshRows())
    cssObserver.observe(document.head, {childList: true, subtree: true, attributes: true})

    let frame = requestAnimationFrame(() => refreshRows())
    window.addEventListener('resize', refreshRows)

    return () => {
      cssObserver.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', refreshRows)
    }
  })
</script>

<div class="style-demo">
  <h1 class="style-demo-title">Style Demo</h1>

  <section class="sample-panel">
    <h1 data-style-demo="h1" use:registerSample>Heading 1</h1>
    <h2 data-style-demo="h2" use:registerSample>Heading 2</h2>
    <h3 data-style-demo="h3" use:registerSample>Heading 3</h3>
    <h4 data-style-demo="h4" use:registerSample>Heading 4</h4>
    <h5 data-style-demo="h5" use:registerSample>Heading 5</h5>
    <h6 data-style-demo="h6" use:registerSample>Heading 6</h6>

    <p data-style-demo="body" use:registerSample>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec vehicula, nisl sit amet facilisis faucibus, velit lorem gravida arcu, nec condimentum justo turpis nec nunc. Sed non mauris in nibh posuere tincidunt.
    </p>
    <p>
      Curabitur dapibus, justo in ullamcorper venenatis, velit tellus euismod enim, non varius nisl sem id est. Integer consequat, est a accumsan sollicitudin, sapien augue gravida lacus, non posuere lorem nibh eget risus. See
      <a data-style-demo="link" use:registerSample href="/index">this link sample</a>
      and <code data-style-demo="code" use:registerSample>inline_code()</code> for inline styling.
    </p>

    <blockquote data-style-demo="blockquote" use:registerSample>
      "Use this page to verify typography and color token changes before publishing reports."
    </blockquote>
  </section>

  <h2>Style variables</h2>
  <table class="token-table">
    <thead>
      <tr>
        <th>Variable</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {#each styleRows as row (row.name)}
        <tr>
          <td><code>{row.name}</code></td>
          <td><code>{row.value}</code></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .style-demo {
    max-width: 1200px;
    margin: 0 auto;
  }

  .style-demo-title {
    margin-top: 0;
  }

  .sample-panel {
    margin-bottom: 1.25rem;
  }

  .token-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.25rem;
    table-layout: fixed;
  }

  .token-table th,
  .token-table td {
    border: 1px solid var(--color-border);
    text-align: left;
    padding: 8px 10px;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
</style>
