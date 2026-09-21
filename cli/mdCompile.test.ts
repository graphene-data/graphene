/// <reference types="vitest/globals" />
import {compile} from 'mdsvex'
import {compile as compileSvelte} from 'svelte/compiler'

import {parseFrontmatter, frontmatterOptions, injectComponentImports, remarkPlugins, rehypePlugins} from './mdCompile.ts'

async function compileMarkdownPage(src: string) {
  let out = await compile(src, {extensions: ['.md'], frontmatter: frontmatterOptions, remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
  if (!out) throw new Error('Expected mdsvex compile output')
  let preprocessed = injectComponentImports().markup({content: String(out.code), filename: '/tmp/repro.md'})
  if (!preprocessed) throw new Error('Expected preprocess output')
  compileSvelte(preprocessed.code, {filename: '/tmp/repro.svelte'})
  return preprocessed.code
}

describe('parseFrontmatter', () => {
  it('uses frontmatter title and navigation visibility together', () => {
    let metadata = parseFrontmatter('---\ntitle: My Page\nhideInNav: true\nlayout: dashboard\n---\n\n# Hello')
    expect(metadata).toEqual({title: 'My Page', hideInNav: true, layout: 'dashboard'})
  })

  it('preserves raw YAML values and custom keys', () => {
    expect(parseFrontmatter('---\nhideInNav: false\ncustom: [one, two]\n---')).toEqual({hideInNav: false, custom: ['one', 'two']})
    expect(parseFrontmatter('---\nhideInNav: "true"\n---')).toEqual({hideInNav: 'true'})
  })

  it('uses a static Markdown h1 without a frontmatter title', () => {
    expect(parseFrontmatter('---\nhideInNav: true\n---\n# Detail Page')).toEqual({title: 'Detail Page', hideInNav: true})
    expect(parseFrontmatter('Intro\n\n# Page title\n\nContent')).toEqual({title: 'Page title'})
  })

  it('parses a one-line scheduled report', () => {
    let contents = '---\nscheduled: "0 9 * * 1-5 @grant"\n---\n# Report'
    expect(parseFrontmatter(contents)).toEqual({title: 'Report', scheduled: '0 9 * * 1-5 @grant'})
  })

  it('leaves schedule validation to the consumer', () => {
    expect(parseFrontmatter('---\nscheduled: "0 9 * *"\n---')).toEqual({scheduled: '0 9 * *'})
    expect(parseFrontmatter('---\nscheduled: "0 9 * * 1-5 deliver however Cloud likes"\n---')).toEqual({scheduled: '0 9 * * 1-5 deliver however Cloud likes'})
  })

  it('supports a YAML list of delivery times', () => {
    let contents = '---\nscheduled:\n  - "0 9 * * 1-5 @grant"\n  - "30 16 * * * #operations"\n---'
    expect(parseFrontmatter(contents)).toEqual({scheduled: ['0 9 * * 1-5 @grant', '30 16 * * * #operations']})
  })

  it('rewrites single and repeated legacy scheduled fields before parsing YAML', () => {
    expect(parseFrontmatter('---\nscheduled: "0 9 * * 1-5" @grant\n---')).toEqual({scheduled: '0 9 * * 1-5 @grant'})
    let contents = '---\nscheduled: "0 9 * * 1-5" @grant\nscheduled: "30 16 * * *" #operations\n---'
    expect(parseFrontmatter(contents)).toEqual({scheduled: ['0 9 * * 1-5 @grant', '30 16 * * * #operations']})
  })

  it('handles leading whitespace and empty YAML', () => {
    expect(parseFrontmatter('\n---\ntitle: Trimmed\n---')).toEqual({title: 'Trimmed'})
    expect(parseFrontmatter('---\n\n---')).toEqual({})
  })

  it('rejects non-object YAML', () => {
    expect(() => parseFrontmatter('---\n- item\n---')).toThrow('Frontmatter must be a YAML object')
  })

  it('ignores dynamic and missing h1 titles', () => {
    expect(parseFrontmatter('# Report for {year}')).toEqual({})
    expect(parseFrontmatter('# Report <span>title</span>')).toEqual({})
    expect(parseFrontmatter('Content without a title')).toEqual({})
  })
})

describe('markdown compilation', () => {
  it('compiles legacy scheduled frontmatter through the shared YAML parser', async () => {
    let code = await compileMarkdownPage('---\nscheduled: "0 9 * * 1-5" @grant\n---\n# Report')
    expect(code).toContain('>Report</h1>')
  })

  it('keeps query code braces inside string literals', async () => {
    let src = `
\`\`\`sql repro
select
  format('{:.1%}', 0.5) as pct
from flights
\`\`\`
`

    let out = await compile(src, {extensions: ['.md'], frontmatter: frontmatterOptions, remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
    if (!out) throw new Error('Expected mdsvex compile output')
    let code = String(out.code)

    expect(code).toContain('<GrapheneQuery name="{`repro`}" code="{`select\\n  format(\'{:.1%}\', 0.5) as pct\\nfrom flights`}" />')
  })

  it('keeps query comparison operators as JavaScript escapes instead of HTML entities', async () => {
    let src = `
\`\`\`sql repro
select * from products
where created_at >= coalesce($daterange_start, created_at)
  and created_at <= coalesce($daterange_end, created_at)
\`\`\`
`

    let out = await compile(src, {extensions: ['.md'], frontmatter: frontmatterOptions, remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
    if (!out) throw new Error('Expected mdsvex compile output')
    let code = String(out.code)

    expect(code).toContain('created_at \\u003e= coalesce')
    expect(code).toContain('created_at \\u003c= coalesce')
    expect(code).not.toContain('&gt;')
    expect(code).not.toContain('&lt;')
  })

  it('allows wrapper components and svelte control flow', async () => {
    let code = await compileMarkdownPage(`
<script>
  let show = true
</script>

{#if show}
<Row>
  <BarChart data="x" y="a" />
  <PieChart data="x" value="a" />
</Row>
{/if}
`)

    expect(code).toContain('{#if show}')
    expect(code).toContain('<Row>')
    expect(code).toContain('<BarChart data="x" y="a" />')
    expect(code).toContain('<PieChart data="x" value="a" />')
  })

  it('allows arbitrary html, scripts, style blocks, and framework directives', async () => {
    let code = await compileMarkdownPage(`
<script>
  let count = 0
</script>

<style>
  .hero { color: red; }
</style>

<div class="hero" on:click={() => count += 1}>{count}</div>
<iframe id="embed" src="javascript:alert('boom')"></iframe>
`)

    expect(code).toContain('let count = 0')
    expect(code).toContain('.hero { color: red; }')
    expect(code).toContain('on:click={() => count += 1}')
    expect(code).toContain('<iframe id="embed" src="javascript:alert(\'boom\')"></iframe>')
  })

  it('keeps generated query and echarts expressions', async () => {
    let code = await compileMarkdownPage(`
\`\`\`sql repro
select '\${literal}' as value
\`\`\`

<ECharts data="repro" title="Demo">
  title: {text: "{b}"},
  series: [{type: "bar"}],
</ECharts>
`)

    expect(code).toContain('<GrapheneQuery name="{`repro`}" code="{`select')
    expect(code).toContain('\\${literal}')
    expect(code).toContain('<ECharts data="repro" title="Demo" config={{"title":{"text":"{b}"},"series":[{"type":"bar"}]}}></ECharts>')
  })
})
