/// <reference types="vitest/globals" />
import {compile} from 'mdsvex'
import {compile as compileSvelte} from 'svelte/compiler'

import {extractFrontmatter, injectComponentImports, remarkPlugins, rehypePlugins, sanitizeCss} from './mdCompile.ts'

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

    expect(code).toContain('<GrapheneQuery name="{`repro`}" code="{`select\\n  format(\'{:.1%}\', 0.5) as pct\\nfrom flights`}"></GrapheneQuery>')
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
    expect(code).toContain('<BarChart data="x" y="a"></BarChart>')
    expect(code).toContain('<PieChart data="x" value="a"></PieChart>')
    expect(code).toContain('</Row>')

    expect(code.indexOf('<BarChart')).toBeLessThan(code.indexOf('<PieChart'))
    expect(code.indexOf('<PieChart')).toBeLessThan(code.indexOf('</Row>'))
  })

  it('allows layout html attributes and page style blocks', async () => {
    let code = await compileMarkdownPage(`
<style>
  .hero { color: rgb(1, 2, 3); background: url("https://example.com/leak"); }
</style>
<style>
  .card { display: grid; }
</style>
<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region" style="color: red">Hello</div>
`)

    expect(code).toContain('<svelte:head><style>')
    expect(code).toContain('.hero { color: rgb(1, 2, 3); }')
    expect(code).toContain('.card { display: grid; }')
    expect(code).toContain('<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region">Hello</div>')
    expect(code).not.toContain('style="color: red"')
    expect(code).not.toContain('example.com/leak')
  })

  it('renders plain braces as text', async () => {
    let code = await compileMarkdownPage(`
Hello {window.mdExpr = true}
`)

    expect(code).toContain('&#123;window.mdExpr = true}')
  })

  it('rejects executable framework syntax and component directives', async () => {
    await expect(compileMarkdownPage('{@html "<img src=x onerror=alert(1)>"}')).rejects.toThrow('Dynamic markup expressions are not supported')
    await expect(compileMarkdownPage('{#if true}oops{/if}')).rejects.toThrow('Dynamic markup expressions are not supported')
    await expect(compileMarkdownPage('<div on:click={window.mdDiv = true}>Click</div>')).rejects.toThrow('Framework directives are not supported')
    await expect(compileMarkdownPage('<BarChart data="x" bind:this={window.mdBind} />')).rejects.toThrow('Framework directives are not supported')
    await expect(compileMarkdownPage('<BarChart data="x" {...window.mdSpread} />')).rejects.toThrow('Attribute spreads are not supported')
    await expect(compileMarkdownPage('<BarChart data={window.mdData} />')).rejects.toThrow('Dynamic attribute expressions are not supported')
  })

  it('keeps generated query and echarts expressions', async () => {
    let code = await compileMarkdownPage(`
\`\`\`sql repro
select '\${literal}' as value
\`\`\`

<ECharts data="repro">
  title: {text: "{b}"},
  series: [{type: "bar"}],
</ECharts>
`)

    expect(code).toContain('<GrapheneQuery name="{`repro`}" code="{`select')
    expect(code).toContain('\\${literal}')
    expect(code).toContain('<ECharts data="repro" config={{"title":{"text":"{b}"},"series":[{"type":"bar"}]}}></ECharts>')
  })

  it('rejects authored component expression attributes', async () => {
    await expect(compileMarkdownPage('<ECharts data="repro" config={alert(1)}></ECharts>')).rejects.toThrow('Dynamic attribute expressions are not supported')
  })

  it('removes css resource and legacy execution hooks', () => {
    let css = sanitizeCss(`
      @import url("https://example.com/base.css");
      .a { color: red; background: image-set(url("https://example.com/a.png") 1x); behavior: url(x.htc); }
      .b { transform: translateX(2px); -moz-binding: url("x.xml#x"); }
      .c { width: expression(alert(1)); }
    `)

    expect(css).toContain('.a { color: red;')
    expect(css).toContain('.b { transform: translateX(2px);')
    expect(css).not.toContain('@import')
    expect(css).not.toContain('example.com')
    expect(css).not.toContain('behavior')
    expect(css).not.toContain('-moz-binding')
    expect(css).not.toContain('expression')
  })
})
