import path from 'path'
import {fileURLToPath} from 'url'
import {type TestProject} from 'vitest/node'

import {prepareDeps} from '../../cli/serve2.ts'
import {setConfig} from '../../lang/config.ts'

export default async function setup(project: TestProject) {
  let viteRoot = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
  setConfig({root: viteRoot})

  // we only need to prepareDeps if we're running ui tests
  let files = project.testFilesList || []
  if (!files.find(f => f.match(/\/ui\/tests\//))) return

  await prepareDeps()
}
