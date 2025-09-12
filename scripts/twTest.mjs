import { chromium } from 'playwright'

async function main () {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://localhost:4000/graphene/tw-test')
  await page.waitForSelector('#results .grid')
  const results = await page.$$eval('#results .grid', (rows) => rows.map(r => r.children[1].textContent))
  console.log(JSON.stringify(results))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

