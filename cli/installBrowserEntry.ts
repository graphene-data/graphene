import {installBrowser} from './installBrowser.ts'

let ok = await installBrowser({
  withDeps: process.argv.includes('--with-deps'),
  postinstall: process.argv.includes('--postinstall'),
})
process.exit(ok ? 0 : 1)
