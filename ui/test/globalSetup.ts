import {serve2, clearVirtualFiles} from '/workspace/cli/serve2.ts'

export default async function () {
  let root = '/workspace/examples/flights'
  await serve2({port: 4100, root})
  return async () => {
    await clearVirtualFiles()
  }
}

