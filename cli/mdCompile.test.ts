/// <reference types="vitest/globals" />
import {compile} from 'mdsvex'
import {compile as compileSvelte} from 'svelte/compiler'

import {extractFrontmatter, injectComponentImports, remarkPlugins, rehypePlugins} from './mdCompile.ts'

async function compileMarkdownPage(src: string) {
  let out = await compile(src, {extensions: ['.md'], remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
  if (!out) throw new Error('Expected mdsvex compile output')
  let preprocessed = injectComponentImports().markup({content: String(out.code), filename: '/tmp/repro.md'})
  if (!preprocessed) throw new Error('Expected preprocess output')
  compileSvelte(preprocessed.code, {filename: '/tmp/repro.svelte'})
  return preprocessed.code
}

describe('extractFrontmatter', () => {
  it('parses title', () => {
    let fm = extractFrontmatter('---\ntitle: My Page\nlayout: dashboard\n---\n\n# Hello')
    expect(fm).toEqual({title: 'My Page'})
  })

  it('returns empty object when no frontmatter', () => {
    expect(extractFrontmatter('# Just a heading')).toEqual({})
  })

  it('handles leading whitespace', () => {
    expect(extractFrontmatter('\n---\ntitle: Trimmed\n---')).toEqual({title: 'Trimmed'})
  })
})

describe('markdown sanitization', () => {
  it('keeps query code braces inside string literals', async () => {
    let src = `
\`\`\`sql repro
select
  format('{:.1%}', 0.5) as pct
from flights
\`\`\`
`

    let out = await compile(src, {extensions: ['.md'], remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
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

    let out = await compile(src, {extensions: ['.md'], remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
    if (!out) throw new Error('Expected mdsvex compile output')
    let code = String(out.code)

    expect(code).toContain('created_at \\u003e= coalesce')
    expect(code).toContain('created_at \\u003c= coalesce')
    expect(code).not.toContain('&gt;')
    expect(code).not.toContain('&lt;')
  })

  it('keeps wrapper components intact across blank lines', async () => {
    let src = `
<Row>
  <BarChart data="x" y="a" />

  <PieChart data="x" value="a" />
</Row>
`

    let out = await compile(src, {remarkPlugins, rehypePlugins})
    if (!out) throw new Error('Expected mdsvex compile output')
    let code = String(out.code)

    expect(code).toContain('<Row>')
    expect(code).toContain('<BarChart data="x" y="a" />')
    expect(code).toContain('<PieChart data="x" value="a" />')
    expect(code).toContain('</Row>')

    expect(code.indexOf('<BarChart')).toBeLessThan(code.indexOf('<PieChart'))
    expect(code.indexOf('<PieChart')).toBeLessThan(code.indexOf('</Row>'))
  })

  it('allows layout html attributes and page style blocks', async () => {
    let code = await compileMarkdownPage(`
<style>
  @import url("https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@500;700&display=swap");
  .hero { color: rgb(1, 2, 3); background: url("https://example.com/leak"); }
</style >
<style>
  .card { display: grid; }
</style>
<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region" style="color: red">Hello</div>
`)

    expect(code).toContain('<svelte:head><style>')
    expect(code).toContain('@import url("https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@500;700&display=swap");')
    expect(code).toContain('.hero { color: rgb(1, 2, 3); background: url("https://example.com/leak"); }')
    expect(code).toContain('.card { display: grid; }')
    expect(code).toContain('<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region" style="color: red">Hello</div>')
    expect(code).toContain('example.com/leak')
  })

  it('allows authored Svelte scripts, expressions, blocks, and event handlers', async () => {
    let code = await compileMarkdownPage(`
<script>
  let mdExpr = 'dynamic'
</script>

{#if mdExpr}
  <button onclick={() => window.mdClicked = true}>{mdExpr}</button>
{/if}

<BarChart data={window.mdData || 'x'} />
`)

    expect(code).toContain("let mdExpr = 'dynamic'")
    expect(code).toContain('onclick={() => window.mdClicked = true}')
    expect(code).toContain("<BarChart data={window.mdData || 'x'} />")

    let inlineScript = await compileMarkdownPage('<script>window.mdInline = true</script>\n# Inline Script')
    expect(inlineScript).toMatch(/components\nwindow\.mdInline = true/)
  })

  it('keeps generated query and echarts expressions', async () => {
    let code = await compileMarkdownPage(`
\`\`\`sql repro
select '\${literal}' as value
\`\`\`

<ECharts data="repro" title="A > B">
  title: {text: "{b}"},
  tooltip: {formatter: params => "carrier: " + params.name},
  series: [{type: "bar"}],
</ECharts>
`)

    expect(code).toContain('<GrapheneQuery name="{`repro`}" code="{`select')
    expect(code).toContain('\\${literal}')
    expect(code).toContain('title="A > B"')
    expect(code).toContain('tooltip: {formatter: params => "carrier: " + params.name}')
  })

  it('allows authored component expression attributes', async () => {
    let code = await compileMarkdownPage('<ECharts data="repro" config={{title: {text: window.chartTitle || "ok"}}}></ECharts>')
    expect(code).toContain('config={{title: {text: window.chartTitle || "ok"}}}')
  })

  it('still rejects malformed Svelte', async () => {
    await expect(compileMarkdownPage('<div>{#if true}</div>')).rejects.toThrow()
  })
})
