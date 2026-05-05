/// <reference types="vitest/globals" />
import {Buffer} from 'buffer'
import {compile} from 'mdsvex'

import {extractFrontmatter, remarkPlugins, rehypePlugins} from './mdCompile.ts'

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

    let expectedCode = Buffer.from("select\n  format('{:.1%}', 0.5) as pct\nfrom flights", 'utf-8').toString('base64')
    expect(code).toContain(`<GrapheneQuery encodedName="cmVwcm8=" encodedCode="${expectedCode}"></GrapheneQuery>`)
    expect(code).not.toContain('{:.1%}')
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
