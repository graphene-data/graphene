/// <reference types="vitest/globals" />
import {compile} from 'mdsvex'
import {remarkPlugins, rehypePlugins} from './mdCompile.ts'

describe('markdown sanitization', () => {
  it('keeps wrapper components intact across blank lines', async () => {
    let src = `
<Row>
  <BarChart data="x" y="a" />

  <PieChart data="x" value="a" />
</Row>
`

    let out = await compile(src, { remarkPlugins, rehypePlugins })
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
