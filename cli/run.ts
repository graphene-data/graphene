import fs from 'fs-extra'
import {readFileSync} from 'node:fs'
import {styleText} from 'node:util'
import path from 'path'
import {chromium, type Page} from 'playwright-core'

import type {GrapheneError} from '../lang/index.d.ts'

import {config} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql} from '../lang/core.ts'
import {type AnalysisResult, type WorkspaceFileInput} from '../lang/types.ts'
import {getGrapheneCache, isServerRunning, runServeInBackground} from './background.ts'
import {runQuery} from './connections/index.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

export interface RunMdFileOptions {
  mdArg: string
  chart?: string
  inputs?: RunInputs
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

type RunInputs = Record<string, string | string[]>

export async function runMdFile(options: RunMdFileOptions): Promise<boolean> {
  let log = options.log || console.log
  let mdFile = normalizeFile(options.mdArg)
  if (!mdFile) {
    log(`Couldn't find ${options.mdArg}`)
    return false
  }

  let files = await loadWorkspace(config.root, false, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
  let mdContents: string
  if (process.env.NODE_ENV == 'test' && mockFileMap[mdFile]) {
    mdContents = mockFileMap[mdFile]
  } else {
    mdContents = readFileSync(path.resolve(config.root, mdFile), 'utf-8')
  }

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdFile).concat({path: mdFile, contents: mdContents, kind: 'md'})}, mdFile)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  let resp = await runPageRequest({mdFile, action: 'check', chart: options.chart, inputs: options.inputs, log})
  if (!resp) return false

  let errors = Array.from(resp.errors || []) as GrapheneError[]
  let chartNotFound = !!options.chart && !resp.screenshot
  if (chartNotFound) log(`Could not find chart "${options.chart}" on ${mdFile}`)

  if (errors.length) {
    log(styleText('red', 'Runtime errors') + ` in ${mdFile}:`)
  } else if (!chartNotFound) {
    log('No errors found 💎')
  }

  errors.forEach((e: GrapheneError) => {
    if (e.file || e.frame) printDiagnostics([e], log)
    else if (e.componentId) log(`${e.componentId}: ${e.message}`)
    else log(e.message)
  })

  if (resp?.stillLoading) {
    log('Warning: Queries were still loading when the screenshot was taken')
  }

  if (resp?.screenshot) {
    let filename = `${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    let screenshotDir = path.join(getGrapheneCache(config.root), 'screenshots')
    let screenshotPath = path.join(screenshotDir, filename)
    await fs.ensureDir(screenshotDir)
    await fs.writeFile(screenshotPath, resp.screenshot)
    log('Screenshot saved to', screenshotPath)
  }

  return errors.length == 0 && !chartNotFound
}

export async function listMdFileQueries(mdArg: string, telemetry?: CliTelemetry, log: (...args: any[]) => void = console.log): Promise<boolean> {
  let mdFile = normalizeFile(mdArg)
  if (!mdFile) {
    log(`Couldn't find ${mdArg}`)
    return false
  }

  let files = await loadWorkspace(config.root, false, config.ignoredFiles)
  telemetry?.event('workspace_scanned', {command: 'list', ...getWorkspaceScanCounts(files)})
  let mdContents = process.env.NODE_ENV == 'test' && mockFileMap[mdFile] ? mockFileMap[mdFile] : readFileSync(path.resolve(config.root, mdFile), 'utf-8')

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdFile).concat({path: mdFile, contents: mdContents, kind: 'md'})}, mdFile)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  let resp = await runPageRequest({mdFile, action: 'list', log})
  if (!resp) return false

  let componentIds = (resp.componentIds || []) as string[]
  if (!componentIds.length) log('No chart queries found')
  else componentIds.forEach(componentId => log(componentId))
  return true
}

export async function runNamedQueryFromMd(mdAbsolutePath: string, queryName: string, options: {inputs?: RunInputs; telemetry?: CliTelemetry} = {}): Promise<boolean> {
  let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
  let mdRelativePath = path.relative(process.cwd(), mdAbsolutePath)
  let mdContents = await fs.promises.readFile(mdAbsolutePath, 'utf-8')

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdRelativePath).concat({path: mdRelativePath, contents: mdContents, kind: 'md'})}, mdRelativePath)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics)
    return false
  }

  let runQueryFence = [mdContents, '', '```sql', `from ${queryName} select *`, '```'].join('\n')
  let queryFiles = toWorkspaceFiles(result)
  let queryResult = analyzeWorkspace({config, files: queryFiles.filter(file => file.path != 'input.md').concat({path: 'input.md', contents: runQueryFence, kind: 'md'})}, 'input.md')
  if (queryResult.diagnostics.length > 0) {
    printDiagnostics(queryResult.diagnostics)
    return false
  }

  let input = getFile(queryResult, 'input.md')
  if (!input?.queries.length) return false
  let sql: string
  try {
    sql = toSql(input.queries[input.queries.length - 1], options.inputs || {})
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    return false
  }
  let res = await runQuery(sql)
  printTable(res.rows)
  return true
}

async function runPageRequest({mdFile, action, chart, inputs, log}: {mdFile: string; action: 'check' | 'list'; chart?: string; inputs?: RunInputs; log: (...args: any[]) => void}) {
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'
  pageUrl = appendInputsToUrl(pageUrl, inputs)

  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

  let host = `http://localhost:${config.port}`
  let browser = await launchHeadlessBrowser(log)
  if (!browser) return null

  try {
    let context = await browser.newContext({
      viewport: {width: 1280, height: 720},
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    let page = await context.newPage()
    await page.goto(host + pageUrl)

    let finished = await page.evaluate(async () => {
      let graphene = (window as any).$GRAPHENE
      if (typeof graphene?.waitForLoad === 'function') return await graphene.waitForLoad(20_000)
      return false
    })

    if (action === 'list') {
      let componentIds = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-component-id]'))
          .map(el => el.getAttribute('data-component-id') || '')
          .filter(componentId => componentId.trim().length > 0),
      )
      await context.close()
      return {componentIds}
    }

    let errors = await page.evaluate(() => ((window as any).$GRAPHENE?.getErrors?.() || []) as GrapheneError[])
    let screenshot = chart ? await captureChart(page, chart) : await page.screenshot({fullPage: true, animations: 'disabled', scale: 'css'})
    await context.close()
    return {errors, stillLoading: !finished, screenshot}
  } catch (err) {
    log(`Failed to ${action == 'check' ? 'run check' : 'list queries'}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  } finally {
    await browser.close()
  }
}

function appendInputsToUrl(pageUrl: string, inputs: RunInputs = {}) {
  let search = new URLSearchParams()
  Object.entries(inputs).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => search.append(name, item))
    else search.append(name, value)
  })
  let rendered = search.toString()
  if (!rendered) return pageUrl
  return `${pageUrl}?${rendered}`
}

async function launchHeadlessBrowser(log: (...args: any[]) => void) {
  try {
    return await chromium.launch({
      headless: true,
      args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-lcd-text', '--force-color-profile=srgb', '--lang=en-US'],
    })
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err)
    if (message.includes('Executable doesn') || message.includes('browserType.launch')) {
      log('Failed to launch headless browser. Run `graphene install-browser` and try again.')
    } else {
      log(`Failed to launch headless browser: ${message}`)
    }
    return null
  }
}

async function captureChart(page: Page, chart: string) {
  let selector = await page.evaluate(chart => {
    let escaped = window.CSS.escape(chart)
    if (document.querySelector(`[data-chart-title="${escaped}"]`)) return `[data-chart-title="${escaped}"]`
    if (document.querySelector(`[data-component-id="${escaped}"]`)) return `[data-component-id="${escaped}"]`
    return null
  }, chart)
  if (!selector) return undefined
  return await page.locator(selector).screenshot({animations: 'disabled', scale: 'css'})
}

function toWorkspaceFiles(analysis: AnalysisResult): WorkspaceFileInput[] {
  return analysis.files.map(file => ({
    path: file.path,
    contents: file.contents,
    kind: file.path.endsWith('.md') ? 'md' : 'gsql',
    parsed: {tree: file.tree!, virtualContents: file.virtualContents, virtualToMarkdownOffset: file.virtualToMarkdownOffset},
  }))
}
