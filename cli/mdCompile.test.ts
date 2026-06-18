/// <reference types="vitest/globals" />
import {compile} from 'mdsvex'
import {compile as compileSvelte} from 'svelte/compiler'

import {extractFrontmatter, injectComponentImports, remarkPlugins, rehypePlugins} from './mdCompile.ts'

async function compileMarkdownPage(src: string) {
  let out = await compile(src, {extensions: ['.md'], remarkPlugins, rehypePlugins, filename: '/tmp/repro.md'})
  if (!out) throw new Error('Expected mdsvex compile output')
  let preprocessed = injectComponentImports().markup({content: String(out.code), filename: '/tmp/repro.md'})
  if (!preprocessed) throw new Error('Expected preprocess output')
  let compiled = compileSvelte(preprocessed.code, {filename: '/tmp/repro.svelte', generate: 'client'})
  return {code: preprocessed.code, css: compiled.css?.code ?? ''}
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
})

describe('page styling', () => {
  it('passes a <style> block and layout html through to Svelte for scoping', async () => {
    let {code, css} = await compileMarkdownPage(`
<style>
  .hero { color: rgb(1, 2, 3); }
  .card { display: grid; }
</style>
<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region" style="color: red">Hello</div>
`)

    // The <style> stays inline as an ordinary component style (not lifted into <svelte:head>).
    expect(code).toContain('<style>')
    expect(code).not.toContain('<svelte:head>')
    // Layout/identifier attributes survive so CSS can target them; inline style="" does not.
    expect(code).toContain('<div class="hero card" id="hero" data-kind="demo" aria-label="Hero" role="region">Hello</div>')
    expect(code).not.toContain('style="color: red"')
    // Svelte scopes the rules to the page (hashed class on the emitted selectors).
    expect(css).toMatch(/\.hero\.svelte-\w+/)
    expect(css).toMatch(/\.card\.svelte-\w+/)
  })
})
