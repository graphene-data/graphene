/// <reference types="vitest/globals" />

import {escapeSvelteTextExpressions, extractPageStyles, sanitizeComponentTag, sanitizeCss, validatePreprocessedMarkup, validateStaticMarkup} from './sanitization.ts'

describe('markup sanitization policy', () => {
  it('rejects executable framework syntax in authored markup', () => {
    expect(() => validateStaticMarkup('{@html "<img src=x onerror=alert(1)>"}')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateStaticMarkup('{#if true}oops{/if}')).toThrow('Dynamic markup expressions are not supported')
    expect(() => validateStaticMarkup('<div on:click={window.clicked = true}>Click</div>')).toThrow('Framework directives are not supported')
    expect(() => validateStaticMarkup('<BarChart data="x" {...window.props} />')).toThrow('Attribute spreads are not supported')
    expect(() => validateStaticMarkup('<BarChart data={window.data} />')).toThrow('Dynamic attribute expressions are not supported')
  })

  it('ignores style and ECharts bodies while validating authored markup', () => {
    expect(() => validateStaticMarkup('<style>.a { color: red; }</style><div>ok</div>')).not.toThrow()
    expect(() => validateStaticMarkup('<ECharts data="x">title: {text: "{b}"}</ECharts>')).not.toThrow()
    expect(() => validatePreprocessedMarkup('<script>let x = {a: 1}</script><div>ok</div>')).not.toThrow()
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

  it('escapes plain braces in text while preserving generated script blocks', () => {
    let content = escapeSvelteTextExpressions('<script>let x = {a: 1}</script><p>{window.x = true}</p>')
    expect(content).toContain('<script>let x = {a: 1}</script>')
    expect(content).toContain('<p>&#123;window.x = true}</p>')
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
