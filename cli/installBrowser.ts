import {spawn} from 'child_process'
import {createRequire} from 'module'
import path from 'path'

const nodeRequire = createRequire(import.meta.url)

export async function installBrowser(options: {withDeps?: boolean; postinstall?: boolean} = {}) {
  if (options.postinstall && process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
    console.log('Skipping Graphene browser install because PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set.')
    return true
  }

  let cliPath = path.join(path.dirname(nodeRequire.resolve('playwright-core')), 'cli.js')
  let args = [cliPath, 'install', '--only-shell', ...(options.withDeps ? ['--with-deps'] : []), 'chromium']
  let result = await new Promise<number>((resolve, reject) => {
    let child = spawn(process.execPath, args, {stdio: 'inherit'})
    child.on('error', reject)
    child.on('close', code => resolve(code ?? 1))
  })

  if (result === 0) return true
  if (!options.postinstall) return false

  console.warn('Graphene could not install its headless browser during package install.')
  console.warn('Run `graphene install-browser` before using `graphene run --headless` screenshots.')
  return true
}
