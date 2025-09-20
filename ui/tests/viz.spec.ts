import {test, expect} from './fixtures'

test('bar chart', async ({mount, page}) => {
  await mount('components/barChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

function makeData () {
  return [
    {origin: 'SFO', avg_delay: 8},
    {origin: 'LAX', avg_delay: 12},
  ]
}
