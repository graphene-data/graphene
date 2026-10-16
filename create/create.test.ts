// Exercise the retired initializer as a real process, including old arguments, and verify it has no filesystem side effects.
import {execFileSync} from 'node:child_process'
import {mkdtemp, readdir, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, it} from 'vitest'

it.each([{argv: []}, {argv: ['demo-app', '--yes', '--no-install']}, {argv: ['--help']}])('prints setup instructions without modifying the project ($argv)', async ({argv}) => {
  let cwd = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
  try {
    await writeFile(path.join(cwd, 'package.json'), '{}\n')
    let stdout = execFileSync(process.execPath, [path.join(import.meta.dirname, 'bin.js'), ...argv], {cwd, encoding: 'utf8'})
    expect(stdout).toBe('create-graphene is deprecated.\n\nHave your agent follow these instructions:\nhttps://github.com/graphene-data/graphene/blob/main/docs/setup.md\n')
    expect(await readdir(cwd)).toEqual(['package.json'])
  } finally {
    await rm(cwd, {recursive: true, force: true})
  }
})
