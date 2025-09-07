import {test, expect} from '@playwright/test'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import {startUiDevServer} from '../devServer.js'

async function writeDuckDB (dir: string) {
  // Create a simple .duckdb by writing malloy-duckdb will create on connect
  await fs.writeFile(path.join(dir, 'test.duckdb'), '')
  // Also create minimal graphene config
  await fs.writeJson(path.join(dir, 'package.json'), {graphene: {dialect: 'duckdb'}}, {spaces: 2})
}

test('renders a simple BarChart from markdown', async ({page}) => {
  let tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'graphene-ui-'))
  await writeDuckDB(tmp)

  // simple dataset via inline SQL
  let md = `# Hello\n\n<BarChart data="q1" x="sku" y="val" />\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n


\n\n\n\n\n\n\n\n\n\n\n\n

\n\n\n``` q1\nmodel m: {}\nfrom (select 'A' sku, 10 val union all select 'B', 20) as q1 {\n  select sku, val\n}\n```\n`
  await fs.writeFile(path.join(tmp, 'index.md'), md)

  let server = await startUiDevServer(tmp)
  let url = server.resolvedUrls?.local?.[0] || 'http://localhost:' + server.config.server.port

  await page.goto(url)
  // wait for web component to upgrade and draw (ECharts uses SVG)
  let chart = page.locator('graphene-BarChart, graphene-barchart')
  await expect(chart).toHaveCount(1)
  await expect(page.locator('svg')).toHaveCount(1)

  await server.close()
})

