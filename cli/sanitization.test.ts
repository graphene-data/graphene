/// <reference types="vitest/globals" />

import {extractPageStyles, sanitizeComponentTag, sanitizeCss, validateStaticMarkup, validateSvelteMarkup} from './sanitization.ts'

describe('markup sanitization policy', () => {
  it('rejects executable framework syntax in authored markup', () => {
    expect(() => validateStaticMarkup('{@html "<img src=x onerror=alert(1)>"}')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateStaticMarkup('{#if true}oops{/if}')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateStaticMarkup('<p>{window.clicked = true}</p>')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateStaticMarkup('<div on:click={window.clicked = true}>Click</div>')).toThrow('Framework directives are not supported')
    expect(() => validateStaticMarkup('<BarChart data="x" {...window.props} />')).toThrow('Attribute spreads are not supported')
    expect(() => validateStaticMarkup('<BarChart data={window.data} />')).toThrow('Dynamic attribute expressions are not supported')
  })

  it('ignores style and ECharts bodies while validating authored markup', () => {
    expect(() => validateStaticMarkup('<style>.a { color: red; }</style><div>ok</div>')).not.toThrow()
    expect(() => validateStaticMarkup('<ECharts data="x">title: {text: "{b}"}</ECharts>')).not.toThrow()
  })

  it('uses the Svelte parser to reject executable syntax in final markup', () => {
    let safe = `
      <svelte:head><style>.a { color: red; }</style></svelte:head>
      <GrapheneQuery name={\`x\`} code={\`select 1\`} />
      <ECharts config={{"series":[]}}></ECharts>
      <div class="a">ok</div>
    `

    expect(() => validateSvelteMarkup(safe)).not.toThrow()
    expect(() => validateSvelteMarkup('<p>{window.x = true}</p>')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateSvelteMarkup('<div on:click={window.x = true}>Click</div>')).toThrow('Framework directives are not supported')
    expect(() => validateSvelteMarkup('<BarChart data={window.data} />')).toThrow('Dynamic attribute expressions are not supported')
    expect(() => validateSvelteMarkup('<BarChart {...window.props} />')).toThrow('Attribute spreads are not supported')
    expect(() => validateSvelteMarkup('<svelte:component this={window.Component} />')).toThrow('Special Svelte elements are not supported')
  })

  it('filters component attributes before Svelte sees them', () => {
    let tag = sanitizeComponentTag('BarChart', {
      data: 'x',
      title: '{window.title}',
      style: 'color: red',
      onclick: 'alert(1)',
      'on:click': 'alert(1)',
    })

    expect(tag.attribs).toEqual({data: 'x', title: '&#123;window.title}'})
  })

  it('preserves generated GrapheneQuery template attributes', () => {
    let tag = sanitizeComponentTag('GrapheneQuery', {
      name: '{`query_name`}',
      code: '{`select \\${literal} as value`}',
    })

    expect(tag.attribs).toEqual({
      name: '{`query_name`}',
      code: '{`select \\${literal} as value`}',
    })
  })

  it('extracts page style blocks and removes them from body html', () => {
    let page = extractPageStyles('<style>.a { color: red; }</style><div class="a">ok</div>')
    expect(page).toEqual({html: '<div class="a">ok</div>', css: '.a { color: red; }'})
  })
})

describe('css sanitization policy', () => {
  it('allows visual resource loading', () => {
    let css = sanitizeCss(`
      @import url("https://example.com/base.css");
      @font-face { src: url("https://example.com/font.woff2") format("woff2"); font-family: "Remote"; }
      .a { background: image-set(url("https://example.com/a.png") 1x); }
    `)

    expect(css).toContain('@import url("https://example.com/base.css")')
    expect(css).toContain('https://example.com/font.woff2')
    expect(css).toContain('image-set(url("https://example.com/a.png") 1x)')
  })

  it('removes legacy css execution hooks', () => {
    let css = sanitizeCss(`
      .a { color: red; behavior: url(x.htc); }
      .b { transform: translateX(2px); -moz-binding: url("x.xml#x"); }
      .c { width: expression(alert(1)); }
      .d { background: url("javascript:alert(1)"); }
      @import url("javascript:alert(1)");
    `)

    expect(css).toContain('.a { color: red; }')
    expect(css).toContain('.b { transform: translateX(2px); }')
    expect(css).not.toContain('behavior')
    expect(css).not.toContain('-moz-binding')
    expect(css).not.toContain('expression')
    expect(css).not.toContain('javascript:')
  })

  it('removes comments and angle brackets before injecting css into the page head', () => {
    let css = sanitizeCss('/* hidden */ .a::after { content: "</style><script>alert(1)</script>"; }')
    expect(css).not.toContain('hidden')
    expect(css).not.toContain('<')
    expect(css).not.toContain('>')
  })
})
