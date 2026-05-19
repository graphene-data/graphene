import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

const copiedPackageFields = [
  'name',
  'version',
  'description',
  'license',
  'author',
  'repository',
  'homepage',
  'bugs',
  'keywords',
  'type',
  'bin',
  'main',
  'types',
  'exports',
  'peerDependencies',
  'peerDependenciesMeta',
  'engines',
]

export function createPublishPackageJson(sourcePackage, workspacePackages) {
  let staged = {}
  for (let field of copiedPackageFields) {
    if (sourcePackage[field] !== undefined) staged[field] = sourcePackage[field]
  }

  let dependencies = {}
  let dependencySources = {}
  let seenWorkspaceDeps = new Set()

  function addDependency(name, spec, owner) {
    if (dependencies[name] && dependencies[name] !== spec) {
      throw new Error(`Dependency version conflict for ${name}: ${dependencies[name]} from ${dependencySources[name]}, ${spec} from ${owner}`)
    }
    dependencies[name] = spec
    dependencySources[name] = owner
  }

  function mergeDependencies(deps, owner) {
    for (let [name, spec] of Object.entries(deps || {})) {
      if (!isWorkspaceSpec(spec)) {
        addDependency(name, spec, owner)
        continue
      }

      if (seenWorkspaceDeps.has(name)) continue
      let workspacePackage = workspacePackages[name]
      if (!workspacePackage) throw new Error(`Missing workspace package metadata for ${name}`)
      seenWorkspaceDeps.add(name)
      mergeDependencies(workspacePackage.dependencies, name)
    }
  }

  mergeDependencies(sourcePackage.dependencies, 'source package')
  if (Object.keys(dependencies).length) staged.dependencies = sortObject(dependencies)
  return staged
}

export async function stageNpmPackage({repoRoot, cliRoot}) {
  let sourcePackage = JSON.parse(await readFile(path.join(cliRoot, 'package.json'), 'utf8'))
  let workspacePackages = await readWorkspacePackages(repoRoot)
  let stagedPackage = createPublishPackageJson(sourcePackage, workspacePackages)
  let npmRoot = path.join(cliRoot, 'dist/npm')

  await rm(npmRoot, {recursive: true, force: true})
  await mkdir(path.join(npmRoot, 'dist'), {recursive: true})

  await cp(path.join(cliRoot, 'bin.js'), path.join(npmRoot, 'bin.js'))
  await copyLicenseFiles(cliRoot, npmRoot)
  await cp(path.join(cliRoot, 'dist', 'index.d.ts'), path.join(npmRoot, 'dist', 'index.d.ts'))
  for (let dir of ['cli', 'ui', 'lang', 'skills']) {
    await cp(path.join(cliRoot, 'dist', dir), path.join(npmRoot, 'dist', dir), {recursive: true})
  }

  await writeFile(path.join(npmRoot, 'package.json'), JSON.stringify(stagedPackage, null, 2) + '\n')
}

async function readWorkspacePackages(repoRoot) {
  let packages = {}
  for (let dir of ['cli', 'lang', 'ui', 'language-server', 'vscode', 'create']) {
    let packagePath = path.join(repoRoot, dir, 'package.json')
    let packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
    packages[packageJson.name] = packageJson
  }
  return packages
}

async function copyLicenseFiles(fromDir, toDir) {
  let files = await readdir(fromDir)
  for (let file of files) {
    let normalized = file.toLowerCase()
    if (!normalized.startsWith('license') && !normalized.includes('notice')) continue
    await cp(path.join(fromDir, file), path.join(toDir, file))
  }
}

function isWorkspaceSpec(spec) {
  return typeof spec === 'string' && spec.startsWith('workspace:')
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}
