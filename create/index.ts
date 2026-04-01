import type {Writable} from 'node:stream'

import {spawn} from 'node:child_process'
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import prompts, {type PromptObject} from 'prompts'

interface CreatePackageJson {
  version?: string
}

interface CreateOptions {
  yes: boolean
  install: boolean | undefined
  name: string | undefined
  targetDir: string | undefined
  help: boolean
}

interface TemplatePackageJson {
  name: string
  version: string
  scripts: {
    graphene: string
    serve: string
    compile: string
    run: string
  }
  dependencies: {
    '@graphenedata/cli': string
    svelte: string
  }
  graphene: {
    dialect: 'duckdb'
  }
}

interface PromptAnswers {
  targetDir?: string
  projectName?: string
  install?: boolean
}

type PromptName = 'targetDir' | 'projectName' | 'install'

interface ResolvedAnswers {
  targetDir: string
  projectName: string
  install: boolean
}

interface CreateContext {
  argv: string[]
  cwd: string
  stdin: NodeJS.ReadStream
  stdout: Writable
  stderr: Writable
}

type TemplateFiles = Record<string, string>

const packageJson = await readCreatePackageJson()

async function readCreatePackageJson(): Promise<CreatePackageJson> {
  try {
    return JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')) as CreatePackageJson
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as CreatePackageJson
  }
}

// Parse the small CLI surface directly so the initializer stays dependency-light.
export function parseArgs(argv: string[]): CreateOptions {
  let options: CreateOptions = {yes: false, install: undefined, name: undefined, targetDir: undefined, help: false}
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]
    if (arg === '--yes' || arg === '-y') {
      options.yes = true
      continue
    }
    if (arg === '--install') {
      options.install = true
      continue
    }
    if (arg === '--no-install') {
      options.install = false
      continue
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--name') {
      if (!argv[i + 1]) throw new Error('--name requires a value')
      options.name = argv[++i]
      continue
    }
    if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length)
      continue
    }
    if (!options.targetDir && !arg.startsWith('-')) {
      options.targetDir = arg
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

// Normalize filesystem names into something safe for package.json.
export function defaultProjectName(targetDir: string): string {
  let raw = path.basename(targetDir || 'graphene-app')
  let normalized = raw
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9._-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return normalized || 'graphene-app'
}

// Keep the first starter intentionally small so the prompt flow can evolve around it.
export function renderTemplate({projectName, cliVersion}: {projectName: string; cliVersion: string}): TemplateFiles {
  let pkg: TemplatePackageJson = {
    name: projectName,
    version: '0.0.1',
    scripts: {
      graphene: 'graphene',
      serve: 'graphene serve',
      compile: 'graphene compile',
      run: 'graphene run',
    },
    dependencies: {
      '@graphenedata/cli': cliVersion,
      svelte: '5.53.7',
    },
    graphene: {
      dialect: 'duckdb',
    },
  }

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    '.gitignore': ['node_modules', '.DS_Store'].join('\n') + '\n',
    'README.md':
      [
        `# ${projectName}`,
        '',
        'This project was bootstrapped with `npm create @graphenedata`.',
        '',
        '## Getting started',
        '',
        '```bash',
        'npm install',
        'npm run serve',
        '```',
        '',
        'Start by editing `index.md` and the files in `tables/`.',
      ].join('\n') + '\n',
    'index.md':
      [
        '# New Graphene Project',
        '',
        'Your project is ready. Start by adding models in `tables/` and queries or charts in this page.',
        '',
        'When you are ready, run `graphene check index.md` to validate the page.',
      ].join('\n') + '\n',
    'tables/example.gsql': ['table example (', '  id int', '  label string', ')'].join('\n') + '\n',
  }
}

export async function ensureEmptyDir(targetDir: string): Promise<void> {
  let entries = await readdir(targetDir).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return null
    throw err
  })
  if (entries === null) return
  if (entries.length > 0) throw new Error(`Target directory is not empty: ${targetDir}`)
}

export async function writeTemplate(targetDir: string, files: TemplateFiles): Promise<void> {
  await mkdir(targetDir, {recursive: true})
  for (let [relativePath, contents] of Object.entries(files)) {
    let filePath = path.join(targetDir, relativePath)
    await mkdir(path.dirname(filePath), {recursive: true})
    await writeFile(filePath, contents)
  }
}

function printHelp(stdout: Writable): void {
  stdout.write(
    [
      'Usage: npm create @graphenedata [target-dir] [-- --yes] [--name <project-name>] [--install|--no-install]',
      '',
      'Options:',
      '  -y, --yes        Skip prompts and accept defaults',
      '  --name <name>    Set the generated package name',
      '  --install        Run npm install after scaffolding',
      '  --no-install     Skip dependency installation',
    ].join('\n') + '\n',
  )
}

async function collectAnswers({options, stdin, stdout}: {options: CreateOptions; stdin: NodeJS.ReadStream; stdout: Writable}): Promise<ResolvedAnswers> {
  let initialTarget = options.targetDir || 'graphene-app'
  let initialName = options.name || defaultProjectName(initialTarget)
  if (options.yes) return {targetDir: initialTarget, projectName: initialName, install: options.install ?? false}

  let questions: PromptObject<PromptName>[] = [
    {
      type: options.targetDir ? null : 'text',
      name: 'targetDir',
      message: 'Where should Graphene create the project?',
      initial: initialTarget,
      validate: value => (typeof value === 'string' && value.trim() ? true : 'Project directory is required'),
    },
    {
      type: options.name ? null : 'text',
      name: 'projectName',
      message: 'Package name',
      initial: prev => defaultProjectName(typeof prev === 'string' && prev ? prev : initialTarget),
      validate: value => (typeof value === 'string' && value.trim() ? true : 'Package name is required'),
    },
    {
      type: options.install == null ? 'toggle' : null,
      name: 'install',
      message: 'Install dependencies now?',
      initial: false,
      active: 'yes',
      inactive: 'no',
    },
  ]

  let promptOptions: {
    onCancel: () => never
    stdin: NodeJS.ReadStream
    stdout: Writable
  } = {
    stdin,
    stdout,
    onCancel() {
      throw new Error('Create canceled')
    },
  }
  let answers = await prompts<PromptName>(questions, promptOptions)
  let promptAnswers = answers as PromptAnswers

  return {
    targetDir: options.targetDir || promptAnswers.targetDir || initialTarget,
    projectName: options.name || promptAnswers.projectName || initialName,
    install: options.install ?? promptAnswers.install ?? false,
  }
}

async function installDeps(targetDir: string, stdout: Writable, stderr: Writable): Promise<void> {
  let child = spawn('npm', ['install'], {
    cwd: targetDir,
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })
  if (!child.stdout || !child.stderr) throw new Error('npm install pipes were not created')

  await new Promise<void>((resolve, reject) => {
    child.stdout.on('data', chunk => stdout.write(chunk))
    child.stderr.on('data', chunk => stderr.write(chunk))
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`npm install failed with code ${code}`))
    })
  })
}

// Resolve answers, write the starter, and optionally install dependencies.
export async function runCreate({argv, cwd, stdin, stdout, stderr}: CreateContext): Promise<void> {
  let options = parseArgs(argv)
  if (options.help) {
    printHelp(stdout)
    return
  }

  let answers = await collectAnswers({options, stdin, stdout})
  let targetDir = path.resolve(cwd, answers.targetDir)
  let projectName = defaultProjectName(answers.projectName)

  await ensureEmptyDir(targetDir)
  let cliVersion = packageJson.version || '0.0.15'
  await writeTemplate(targetDir, renderTemplate({projectName, cliVersion}))

  stdout.write(`Created Graphene project in ${targetDir}\n`)
  if (!answers.install) {
    stdout.write('Skipped npm install\n')
    return
  }

  await installDeps(targetDir, stdout, stderr)
  stdout.write('Installed dependencies\n')
}
