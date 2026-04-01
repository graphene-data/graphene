import type {Readable, Writable} from 'node:stream'

import * as clack from '@clack/prompts'
import {spawn} from 'node:child_process'
import {access, mkdir, readFile, readdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

interface CreatePackageJson {
  version?: string
}

type Database = 'duckdb' | 'snowflake' | 'bigquery'

interface CreateOptions {
  yes: boolean
  install: boolean | undefined
  name: string | undefined
  targetDir: string | undefined
  help: boolean
}

interface DuckDbConfig {
  path: string
}

interface SnowflakeConfig {
  account: string
  username: string
}

interface BigQueryConfig {
  projectId: string
}

interface GrapheneTemplateConfig {
  dialect: Database
  defaultNamespace?: string
  duckdb?: DuckDbConfig
  snowflake?: SnowflakeConfig
  bigquery?: BigQueryConfig
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
  graphene: GrapheneTemplateConfig
}

interface CreateContext {
  argv: string[]
  cwd: string
  stdin: Readable
  stdout: Writable
  stderr: Writable
}

interface ScaffoldAnswers {
  targetDir: string
  projectName: string
  database: Database
  defaultNamespace?: string
  duckdbPath?: string
  snowflakeAccount?: string
  snowflakeUsername?: string
  snowflakeKeyPath?: string
  snowflakePassphrase?: string
  bigqueryProjectId?: string
  bigqueryKeyPath?: string
  install: boolean
}

interface InstallResult {
  code: number
  stderr: string
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

class CreateCancelled extends Error {
  constructor() {
    super('Create canceled')
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

export function renderTemplate({answers, cliVersion}: {answers: ScaffoldAnswers; cliVersion: string}): TemplateFiles {
  let graphene: GrapheneTemplateConfig = {dialect: answers.database}
  if (answers.defaultNamespace) graphene.defaultNamespace = answers.defaultNamespace
  if (answers.database === 'duckdb') graphene.duckdb = {path: answers.duckdbPath || './data.duckdb'}
  else if (answers.database === 'snowflake') graphene.snowflake = {account: answers.snowflakeAccount || '', username: answers.snowflakeUsername || ''}
  else graphene.bigquery = {projectId: answers.bigqueryProjectId || ''}

  let pkg: TemplatePackageJson = {
    name: answers.projectName,
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
    graphene,
  }

  let files: TemplateFiles = {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    '.gitignore': ['node_modules', '.env', '*.duckdb'].join('\n') + '\n',
    'index.md': renderIndex(answers),
  }

  let envFile = renderEnvFile(answers)
  if (envFile) files['.env'] = envFile

  return files
}

function renderIndex(answers: ScaffoldAnswers): string {
  let dialectLabel = 'DuckDB'
  if (answers.database === 'snowflake') dialectLabel = 'Snowflake'
  else if (answers.database === 'bigquery') dialectLabel = 'BigQuery'
  return [`# ${answers.projectName}`, '', `This Graphene project is configured for ${dialectLabel}.`, '', 'Start by adding models and queries to this project.'].join('\n') + '\n'
}

function renderEnvFile(answers: ScaffoldAnswers): string | null {
  let lines: string[] = []
  if (answers.database === 'snowflake') {
    lines.push(`SNOWFLAKE_PRI_KEY_PATH=${answers.snowflakeKeyPath || ''}`)
    if (answers.snowflakePassphrase) lines.push(`SNOWFLAKE_PRI_PASSPHRASE=${answers.snowflakePassphrase}`)
  } else if (answers.database === 'bigquery') {
    lines.push(`GOOGLE_APPLICATION_CREDENTIALS=${answers.bigqueryKeyPath || ''}`)
  }
  return lines.length ? lines.join('\n') + '\n' : null
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

function promptOptions(input: Readable, output: Writable) {
  return {input, output}
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (clack.isCancel(value)) throw new CreateCancelled()
  return value
}

function validateRequired(message: string) {
  return (value: string | undefined) => {
    if (typeof value !== 'string' || !value.trim()) return message
  }
}

function validateFileExtension(filePath: string | undefined, expectedExtension: string): string | undefined {
  if (typeof filePath !== 'string' || !filePath.trim()) return `Path to ${expectedExtension} file is required`
  if (!filePath.endsWith(expectedExtension)) return `File must end with ${expectedExtension}`
}

async function promptExistingFilePath({message, expectedExtension, input, output}: {message: string; expectedExtension: string; input: Readable; output: Writable}): Promise<string> {
  while (true) {
    let filePath = unwrapPrompt(
      await clack.path({
        message,
        validate: value => validateFileExtension(value, expectedExtension),
        ...promptOptions(input, output),
      }),
    )
    try {
      await access(filePath)
      return filePath
    } catch {
      clack.log.error(`File not found: ${filePath}`, {output})
    }
  }
}

function namespacePlaceholder(database: Database) {
  if (database === 'snowflake') return 'MY_DB.ANALYTICS'
  if (database === 'bigquery') return 'my-project.analytics'
  return 'analytics'
}

async function collectAnswers({options, input, output}: {options: CreateOptions; input: Readable; output: Writable}): Promise<ScaffoldAnswers> {
  if (options.yes) {
    let targetDir = options.targetDir || 'graphene-app'
    return {
      targetDir,
      projectName: options.name || defaultProjectName(targetDir),
      database: 'duckdb',
      duckdbPath: './data.duckdb',
      install: options.install ?? false,
    }
  }

  let targetDir = options.targetDir
  if (!targetDir) {
    targetDir = unwrapPrompt(
      await clack.text({
        message: 'Project name',
        placeholder: 'my-analytics',
        initialValue: 'graphene-app',
        validate: validateRequired('Project name is required'),
        ...promptOptions(input, output),
      }),
    )
  }

  let projectName = options.name || defaultProjectName(targetDir)
  let database = unwrapPrompt(
    await clack.select<Database>({
      message: 'Database',
      options: [
        {value: 'duckdb', label: 'DuckDB (local file)'},
        {value: 'snowflake', label: 'Snowflake'},
        {value: 'bigquery', label: 'BigQuery'},
      ],
      ...promptOptions(input, output),
    }),
  )

  let defaultNamespace = unwrapPrompt(
    await clack.text({
      message: 'Default namespace (optional)',
      placeholder: namespacePlaceholder(database),
      ...promptOptions(input, output),
    }),
  ).trim()

  let answers: ScaffoldAnswers = {
    targetDir,
    projectName,
    database,
    defaultNamespace: defaultNamespace || undefined,
    install: false,
  }

  if (database === 'duckdb') {
    answers.duckdbPath = unwrapPrompt(
      await clack.text({
        message: 'Path to .duckdb file',
        placeholder: './data.duckdb',
        initialValue: './data.duckdb',
        validate(value) {
          if (typeof value !== 'string' || !value.trim()) return 'DuckDB path is required'
          if (!value.endsWith('.duckdb')) return 'DuckDB path must end with .duckdb'
        },
        ...promptOptions(input, output),
      }),
    )
  } else if (database === 'snowflake') {
    answers.snowflakeAccount = unwrapPrompt(
      await clack.text({
        message: 'Snowflake account ID',
        placeholder: 'myorg-myaccount',
        validate: validateRequired('Snowflake account ID is required'),
        ...promptOptions(input, output),
      }),
    )
    answers.snowflakeUsername = unwrapPrompt(
      await clack.text({
        message: 'Snowflake username',
        placeholder: 'graphene_user',
        validate: validateRequired('Snowflake username is required'),
        ...promptOptions(input, output),
      }),
    )
    answers.snowflakeKeyPath = await promptExistingFilePath({message: 'Path to .p8 key file', expectedExtension: '.p8', input, output})
    answers.snowflakePassphrase = unwrapPrompt(
      await clack.password({
        message: 'Key passphrase',
        ...promptOptions(input, output),
      }),
    )
  } else {
    answers.bigqueryProjectId = unwrapPrompt(
      await clack.text({
        message: 'GCP project ID',
        placeholder: 'my-project-123',
        validate: validateRequired('GCP project ID is required'),
        ...promptOptions(input, output),
      }),
    )
    answers.bigqueryKeyPath = await promptExistingFilePath({message: 'Path to service account .json key file', expectedExtension: '.json', input, output})
  }

  answers.install =
    options.install ??
    unwrapPrompt(
      await clack.confirm({
        message: 'Install dependencies now?',
        initialValue: true,
        ...promptOptions(input, output),
      }),
    )

  return answers
}

async function installDeps(targetDir: string): Promise<InstallResult> {
  let task = clack.taskLog({title: 'Installing dependencies...'})
  let child = spawn('npm', ['install'], {cwd: targetDir, stdio: ['ignore', 'pipe', 'pipe']})
  if (!child.stdout || !child.stderr) throw new Error('npm install pipes were not created')
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  let forward = (chunk: string) => {
    for (let line of chunk.split(/\r?\n/)) {
      if (!line.trim()) continue
      task.message(line)
    }
  }

  child.stdout.on('data', chunk => forward(String(chunk)))
  child.stderr.on('data', chunk => {
    let text = String(chunk)
    stderr += text
    forward(text)
  })

  let code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', exitCode => resolve(exitCode ?? 1))
  })

  if (code === 0) task.success('Dependencies installed')
  else task.error('npm install failed', {showLog: true})

  return {code, stderr}
}

// Resolve answers, write the starter, and optionally install dependencies.
export async function runCreate({argv, cwd, stdin, stdout}: CreateContext): Promise<void> {
  let options = parseArgs(argv)
  if (options.help) {
    printHelp(stdout)
    return
  }

  clack.intro('Create a new Graphene project', {output: stdout})

  try {
    let answers = await collectAnswers({options, input: stdin, output: stdout})
    let targetDir = path.resolve(cwd, answers.targetDir)

    await ensureEmptyDir(targetDir)
    let cliVersion = packageJson.version || '0.0.15'
    await writeTemplate(targetDir, renderTemplate({answers, cliVersion}))

    if (answers.install) {
      let install = await installDeps(targetDir)
      if (install.code !== 0) throw new Error(install.stderr.trim() || `npm install failed with code ${install.code}`)
    }

    clack.outro('Done!', {output: stdout})
  } catch (err) {
    if (err instanceof CreateCancelled) {
      clack.cancel('Operation cancelled.', {output: stdout})
      return
    }
    throw err
  }
}
