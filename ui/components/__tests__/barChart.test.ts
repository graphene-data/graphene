import {test, expect} from 'vitest'
import BarChart from '../barChart.svelte'

// Ensure browser-like globals for Evidence utilities that access localStorage
;(globalThis as any).localStorage ||= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
}

// Minimal Svelte component mount helper using DOM
function mount(Component: any, target: HTMLElement, props: Record<string, any>) {
  // Evidence component expects window.$GRAPHENE.query to resolve rows
  if (!window.$GRAPHENE) {
    ;(window as any).$GRAPHENE = {
      query: async () => [{label: 'A', value: 1}, {label: 'B', value: 2}],
      loadingQueries: new Set(),
    }
  }
  return new Component({target, props})
}

test('it renders barcharts', async () => {
  let container = document.createElement('div')
  document.body.appendChild(container)

  let comp = mount(BarChart, container, {data: 'test', x: 'label', y: 'value', title: 'T'})

  // Allow microtasks + chart init
  await new Promise(r => setTimeout(r, 50))

  // Evidence BarChart renders an SVG
  let svg = container.querySelector('svg')
  expect(svg).toBeTruthy()

  comp.$destroy()
  container.remove()
})

