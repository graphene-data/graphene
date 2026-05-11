import {spawn} from 'child_process'
import {createRequire} from 'module'

const nodeRequire = createRequire(import.meta.url)

export async function installBrowser(options: {withDeps?: boolean; postinstall?: boolean} = {}) {
  if (options.postinstall && process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
    console.log('Skipping Graphene browser install because PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set.')
    return true
  }

  let cliPath = nodeRequire.resolve('playwright-core/cli.js')
  let args = [cliPath, 'install', '--only-shell', ...(options.withDeps ? ['--with-deps'] : []), 'chromium']
  let result = await new Promise<number>((resolve, reject) => {
    let child = spawn(process.execPath, args, {stdio: 'inherit'})
    child.on('error', reject)
    child.on('close', code => resolve(code ?? 1))
  })

  if (result === 0) return true
  if (!options.postinstall) return false

  console.warn('Graphene could not install its headless browser during package install.')
  console.warn('Run `graphene install-browser` before using `graphene run` screenshots.')
  return true
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  let ok = await installBrowser({
    withDeps: process.argv.includes('--with-deps'),
    postinstall: process.argv.includes('--postinstall'),
  })
  process.exit(ok ? 0 : 1)
}
