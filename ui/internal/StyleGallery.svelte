<script lang="ts">
  import {onMount} from 'svelte'

  let styleVars = [
    '--font-prose',
    '--font-sans',
    '--font-ui',
    '--font-mono',
    '--color-bg',
    '--color-primary-strong',
    '--color-body',
    '--color-muted',
    '--color-tertiary',
    '--color-border',
    '--color-border-strong',
    '--color-code-bg',
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
    <p>This is a regular paragraph at the top of the post. It has a couple sentences to give it some body. The quick brown fox jumps over the lazy dog.</p>

    <h1 data-style-demo="h1" use:registerSample>Heading 1</h1>
    <p>This is text after an h1. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>

    <h2 data-style-demo="h2" use:registerSample>Heading 2</h2>
    <p>This is text after an h2. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

    <h3 data-style-demo="h3" use:registerSample>Heading 3</h3>
    <p>This is text after an h3. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>

    <h2>Paragraph spacing</h2>
    <p>Here is the first paragraph. It should have visible space below it before the next paragraph starts.</p>
    <p>Here is the second paragraph. There should be a clear gap between this and the paragraph above. If the spacing is working correctly, you'll see breathing room between each block.</p>
    <p>Here is a third paragraph to make it obvious.</p>

    <h2>Unordered list</h2>
    <ul>
      <li>First item in the list</li>
      <li>Second item with <strong>bold text</strong> inside it</li>
      <li>Third item with <em>italic text</em> inside it</li>
      <li>Fourth item that is a bit longer to see how it wraps across multiple lines on smaller viewports</li>
      <li>Fifth and final item</li>
    </ul>

    <h2>Ordered list</h2>
    <ol>
      <li>Step one: install dependencies</li>
      <li>Step two: configure your environment</li>
      <li>Step three: run the dev server</li>
      <li>Step four: open your browser at localhost</li>
      <li>Step five: profit</li>
    </ol>

    <h2>Nested lists</h2>
    <ul>
      <li>Top level item A
        <ul>
          <li>Nested item A1</li>
          <li>Nested item A2
            <ul>
              <li>Doubly nested A2a</li>
            </ul>
          </li>
        </ul>
      </li>
      <li>Top level item B
        <ul>
          <li>Nested item B1</li>
        </ul>
      </li>
      <li>Top level item C</li>
    </ul>

    <h2>Inline formatting</h2>
    <p data-style-demo="body" use:registerSample>
      This paragraph has <strong>bold text</strong>, <em>italic text</em>, <del>strikethrough text</del>, and <code data-style-demo="code" use:registerSample>inline code</code>. It also has a <a data-style-demo="link" use:registerSample href="/index">link to the about page</a> to test link styling.
    </p>
    <p>You can also combine: <strong><em>bold and italic</em></strong> together.</p>

    <h2>Blockquote</h2>
    <blockquote data-style-demo="blockquote" use:registerSample>
      This is a blockquote. It should have a left border and be visually distinct from regular paragraph text. It might span multiple lines to show how longer quotes are handled.
    </blockquote>
    <blockquote>Another blockquote with <strong>bold</strong> and <em>italic</em> inside it.</blockquote>

    <h2>Horizontal rule</h2>
    <p>Above the rule.</p>
    <hr />
    <p>Below the rule.</p>

    <h2>Table</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Kevin Marr</td><td>Co-Founder &amp; CEO</td><td>San Francisco</td></tr>
        <tr><td>Grant Marvin</td><td>Co-Founder &amp; CTO</td><td>San Francisco</td></tr>
        <tr><td>Dylan Scott</td><td>Founding Engineer</td><td>San Francisco</td></tr>
      </tbody>
    </table>
    <p>A table with alignment:</p>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Metric</th>
          <th style="text-align:right">Q1</th>
          <th style="text-align:right">Q2</th>
          <th style="text-align:right">Q3</th>
          <th style="text-align:right">Change</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:left">Revenue</td>
          <td style="text-align:right">$1.2M</td>
          <td style="text-align:right">$1.8M</td>
          <td style="text-align:right">$2.4M</td>
          <td style="text-align:right">+33%</td>
        </tr>
        <tr>
          <td style="text-align:left">Active users</td>
          <td style="text-align:right">4,200</td>
          <td style="text-align:right">6,100</td>
          <td style="text-align:right">8,800</td>
          <td style="text-align:right">+44%</td>
        </tr>
        <tr>
          <td style="text-align:left">Queries / day</td>
          <td style="text-align:right">12,000</td>
          <td style="text-align:right">19,500</td>
          <td style="text-align:right">31,000</td>
          <td style="text-align:right">+59%</td>
        </tr>
      </tbody>
    </table>

    <h2>Mixed content</h2>
    <p>Here's a paragraph followed by a list:</p>
    <p>There are three reasons analytics should live in your repo:</p>
    <ol>
      <li><strong>Drift prevention.</strong> When your semantic model is versioned alongside your dbt code, column renames and schema changes surface as type errors immediately.</li>
      <li><strong>Code review.</strong> Changes to metrics and dashboards go through PRs just like application code — with diffs, comments, and history.</li>
      <li><strong>Agent compatibility.</strong> AI coding agents work in your repo. If your analytics layer is a GUI, agents are locked out.</li>
    </ol>
    <p>And then back to regular prose after the list.</p>

    <h2>Final paragraph</h2>
    <p>This is the last paragraph of the post. Everything above should be styled consistently and match the overall site aesthetic — using the same font, color tokens, and spacing as the rest of graphenedata.com.</p>
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
