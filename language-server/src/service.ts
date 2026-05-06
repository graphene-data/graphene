import {type createServer} from '@volar/language-server/node.js'
import {type LanguageServicePlugin, type LanguageServicePluginInstance} from '@volar/language-service'
import {glob} from 'glob'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  FileChangeType,
  type Diagnostic,
  type Disposable,
  type DocumentUri,
  type Location,
  type LocationLink,
  type WorkspaceDocumentDiagnosticReport,
} from 'vscode-languageserver-protocol'
import {URI} from 'vscode-uri'

import {type Config, loadConfig} from '../../lang/config.ts'
import {analyzeWorkspace, getDefinition, getDiagnostics, getFiles, getHover, getReferences, loadWorkspace} from '../../lang/core.ts'
import {type AnalysisResult, type GrapheneError, type Location as GrapheneLocation, type WorkspaceFileInput} from '../../lang/types.ts'

type ProjectRoot = string

interface ProjectState {
  root: ProjectRoot
  config: Config
  files: WorkspaceFileInput[]
  analysis: AnalysisResult
}

export interface DiscoveredGrapheneProject {
  root: ProjectRoot
  config: Config
}

export function createGrapheneService(server: ReturnType<typeof createServer>): LanguageServicePlugin {
  return {
    name: 'graphene',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: true,
        workspaceDiagnostics: true,
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
    },
    create(context): LanguageServicePluginInstance {
      let projects = new Map<ProjectRoot, ProjectState>()
      let dirtyRoots = new Set<ProjectRoot>()
      let reportedDiagnosticUris = new Set<string>()
      let log = (...args: unknown[]) => {
        let message = args.map(arg => (typeof arg == 'string' ? arg : JSON.stringify(arg))).join(' ')
        console.log(message)
        server.connection.console.log(message)
      }
      let analysis = createWorkspaceAnalysis({
        load: loadProjects,
        analyze: analyzeDirtyProjects,
        delay: 200,
      })
      let workspaceWatcher = watchWorkspace()

      return {
        dispose() {
          analysis.dispose()
          workspaceWatcher.dispose()
        },
        async provideHover(document, position) {
          await analysis.pending

          let target = projectFromUri(document.uri)
          if (!target) return null
          return {contents: getHover(target.project.analysis, target.path, position.line, position.character)}
        },
        async provideDefinition(document, position, _token) {
          await analysis.pending

          let target = projectFromUri(document.uri)
          if (!target) return []
          let location = getDefinition(target.project.analysis, target.path, position.line, position.character)
          return location ? [toLocationLink(target.project.root, location)] : []
        },
        async provideReferences(document, position, context, _token) {
          await analysis.pending

          let target = projectFromUri(document.uri)
          if (!target) return []
          return getReferences(target.project.analysis, target.path, position.line, position.character, context.includeDeclaration).map(location => toLocation(target.project.root, location))
        },
        async provideDiagnostics(document) {
          await analysis.pending

          let target = projectFromUri(document.uri)
          if (!target) return []
          return diagnosticsFor(target.project, target.path)
        },
        async provideWorkspaceDiagnostics() {
          await analysis.pending
          return workspaceDiagnostics()
        },
      }

      async function loadProjects() {
        let discovered = await discoverGrapheneProjects(context.env.workspaceFolders || [])
        let next = new Map<ProjectRoot, ProjectState>()

        await Promise.all(
          discovered.map(async project => {
            let files = await loadWorkspace(project.root, true, project.config.ignoredFiles)
            next.set(project.root, {root: project.root, config: project.config, files, analysis: {files: [], diagnostics: []}})
          }),
        )

        projects = next
        dirtyRoots = new Set(next.keys())
        log('[graphene] started language server', [...projects.values()].map(project => ({root: project.root, files: project.files.length})))
      }

      function watchWorkspace(): Disposable {
        let fileWatcher: Disposable | undefined
        let changeWatchedFiles: Disposable | undefined
        let directChangeWatchedFiles: Disposable | undefined
        let changeContent: Disposable | undefined

        server.onInitialized(async () => {
          log('[graphene] registering file watcher for **/*.gsql and **/*.md')
          fileWatcher = await server.fileWatcher.watchFiles(['**/*.gsql', '**/*.md'])
          log('[graphene] file watcher registered')
        })

        changeWatchedFiles = server.fileWatcher.onDidChangeWatchedFiles(({changes}) => {
          log('[graphene] volar watched files changed', changes.map(change => ({type: fileChangeTypeName(change.type), uri: change.uri})))
          void applyFileChanges(changes)
        })

        directChangeWatchedFiles = server.connection.onDidChangeWatchedFiles(({changes}) => {
          log('[graphene] direct watched files changed', changes.map(change => ({type: fileChangeTypeName(change.type), uri: change.uri})))
          void applyFileChanges(changes)
        })

        changeContent = server.documents.onDidChangeContent(({document}) => {
          log('[graphene] document content changed', document.uri)
          let target = projectFromUri(document.uri)
          if (!target) {
            log('[graphene] document change ignored because no project owns it', document.uri)
            return
          }

          target.project.files = upsertFile(target.project.files, {path: target.path, contents: document.getText()})
          dirtyRoots.add(target.project.root)
          log('[graphene] queued analysis from document change', {root: target.project.root, path: target.path, files: target.project.files.length})
          analysis.invalidate()
        })

        return {
          dispose() {
            fileWatcher?.dispose()
            changeWatchedFiles?.dispose()
            directChangeWatchedFiles?.dispose()
            changeContent?.dispose()
          },
        }
      }

      async function applyFileChanges(changes: {uri: DocumentUri; type: FileChangeType}[]) {
        let touched = false

        for (let change of changes) {
          let target = projectFromUri(change.uri)
          if (!target) {
            log('[graphene] watched file ignored because no project owns it', {type: fileChangeTypeName(change.type), uri: change.uri})
            continue
          }

          if (change.type === FileChangeType.Deleted) {
            target.project.files = target.project.files.filter(file => file.path != target.path)
            log('[graphene] deleted workspace file', {root: target.project.root, path: target.path, files: target.project.files.length})
          } else {
            let document = server.documents.get(URI.parse(change.uri))
            let contents = document?.getText() || (await readWorkspaceFile(target.absolutePath))
            if (contents == null) {
              log('[graphene] watched file changed but could not be read', {type: fileChangeTypeName(change.type), uri: change.uri})
              continue
            }
            target.project.files = upsertFile(target.project.files, {path: target.path, contents})
            log('[graphene] upserted workspace file', {type: fileChangeTypeName(change.type), root: target.project.root, path: target.path, bytes: contents.length, source: document ? 'open document' : 'disk', files: target.project.files.length})
          }

          dirtyRoots.add(target.project.root)
          touched = true
        }

        if (touched) {
          log('[graphene] queued analysis from watched file change', [...dirtyRoots])
          analysis.invalidate()
        } else {
          log('[graphene] watched file changes did not touch any projects')
        }
      }

      function projectFromUri(uri: DocumentUri) {
        let absolutePath = fileUriPath(uri)
        if (!absolutePath) return null

        let root = findOwningProjectRoot(absolutePath, projects.keys())
        if (!root) return null

        let project = projects.get(root)
        if (!project) return null

        return {
          project,
          absolutePath,
          path: path.relative(root, absolutePath),
        }
      }

      async function analyzeDirtyProjects() {
        let changed = false

        for (let root of dirtyRoots) {
          let project = projects.get(root)
          if (!project) continue

          try {
            log('[graphene] analyzing project', {root, files: project.files.length})
            project.analysis = analyzeWorkspace({config: project.config, files: project.files})
            project.files = updateParsedFiles(project.files, project.analysis)
            log('[graphene] analyzed project', {root, diagnostics: project.analysis.diagnostics.length})
            changed = true
          } catch (err) {
            let message = err instanceof Error ? err.stack || err.message : String(err)
            console.error(`Analyze failed for ${root}: ${message}`)
          }
        }

        dirtyRoots.clear()
        if (changed) {
          log('[graphene] requesting diagnostic refresh')
          await server.languageFeatures.requestRefresh(false)
        }
      }

      function diagnosticsFor(project: ProjectState, filePath: string) {
        return getDiagnostics(project.analysis)
          .filter(diagnostic => diagnostic.file === filePath)
          .map(toDiagnostic)
      }

      function workspaceDiagnostics() {
        let currentUris = new Set<string>()
        let reports: WorkspaceDocumentDiagnosticReport[] = []

        for (let project of projects.values()) {
          for (let file of getFiles(project.analysis)) {
            let uri = URI.file(path.resolve(project.root, file.path)).toString()
            currentUris.add(uri)
            reports.push({
              kind: DocumentDiagnosticReportKind.Full,
              uri,
              version: null,
              items: diagnosticsFor(project, file.path),
            })
          }
        }

        for (let uri of reportedDiagnosticUris) {
          if (currentUris.has(uri)) continue
          reports.push({
            kind: DocumentDiagnosticReportKind.Full,
            uri,
            version: null,
            items: [],
          })
        }

        reportedDiagnosticUris = currentUris
        return reports
      }
    },
  }
}

export async function discoverGrapheneProjects(workspaceFolders: readonly URI[]): Promise<DiscoveredGrapheneProject[]> {
  let projects = new Map<ProjectRoot, DiscoveredGrapheneProject>()

  for (let workspace of workspaceFolders) {
    await addGrapheneProject(projects, workspace.fsPath)

    let packageJsonPaths = await glob('**/package.json', {
      cwd: workspace.fsPath,
      ignore: ['node_modules/**', '**/.*/**'],
      follow: false,
    })

    for (let packageJsonPath of packageJsonPaths) {
      await addGrapheneProject(projects, path.join(workspace.fsPath, path.dirname(packageJsonPath)))
    }
  }

  return [...projects.values()].sort((left, right) => left.root.localeCompare(right.root))
}

async function addGrapheneProject(projects: Map<ProjectRoot, DiscoveredGrapheneProject>, searchRoot: string) {
  try {
    let config = await loadConfig(searchRoot, () => {})
    projects.set(config.root, {root: config.root, config})
  } catch (err) {
    if (!String(err).includes('No graphene config found') && !String(err).includes('No package.json found')) throw err
  }
}

export function findOwningProjectRoot(filePath: string, projectRoots: Iterable<ProjectRoot>): ProjectRoot | null {
  let matches = [...projectRoots].filter(root => containsPath(root, filePath))
  if (!matches.length) return null
  matches.sort((left, right) => right.length - left.length)
  return matches[0]
}

function containsPath(root: ProjectRoot, filePath: string) {
  let relative = path.relative(root, filePath)
  return relative == '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function readWorkspaceFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function fileUriPath(uri: DocumentUri): string | null {
  let parsed = URI.parse(uri)
  if (parsed.scheme !== 'file') return null
  return parsed.fsPath
}

function fileChangeTypeName(type: FileChangeType) {
  if (type === FileChangeType.Created) return 'created'
  if (type === FileChangeType.Changed) return 'changed'
  if (type === FileChangeType.Deleted) return 'deleted'
  return String(type)
}

function upsertFile(files: WorkspaceFileInput[], next: WorkspaceFileInput) {
  let idx = files.findIndex(file => file.path == next.path)
  if (idx < 0) return [...files, next]
  return files.map((file, fileIdx) => (fileIdx == idx ? next : file))
}

function updateParsedFiles(files: WorkspaceFileInput[], analysis: AnalysisResult) {
  return files.map(file => {
    let analyzed = analysis.files.find(next => next.path == file.path)
    if (!analyzed) return file
    return {
      ...file,
      parsed: {
        tree: analyzed.tree!,
        virtualContents: analyzed.virtualContents,
        virtualToMarkdownOffset: analyzed.virtualToMarkdownOffset,
      },
    }
  })
}

// Coordinates workspace analysis: load once, run the initial analysis immediately,
// debounce later invalidations, and expose the latest pending cycle to providers.
function createWorkspaceAnalysis({load, analyze, delay}: {load: () => Promise<void>; analyze: () => Promise<void>; delay: number}) {
  let handle: NodeJS.Timeout | undefined
  let disposed = false
  let ready = load()
  let pending = ready.then(analyze)

  return {
    get pending() {
      return pending
    },
    invalidate() {
      if (disposed) return pending
      if (handle) clearTimeout(handle)

      pending = ready.then(
        () =>
          new Promise<void>(resolve => {
            handle = setTimeout(() => {
              handle = undefined
              analyze().finally(resolve)
            }, delay)
          }),
      )

      return pending
    },
    dispose() {
      disposed = true
      if (handle) clearTimeout(handle)
    },
  }
}

function toDiagnostic(diagnostic: GrapheneError): Diagnostic {
  let from = diagnostic.from || {line: 0, col: 0}
  let to = diagnostic.to || from
  return {
    range: {
      start: {line: from.line, character: from.col},
      end: {line: to.line, character: to.col},
    },
    severity: diagnostic.severity === 'warn' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
    message: diagnostic.message,
    source: 'graphene',
  }
}

function toLocation(root: ProjectRoot, location: GrapheneLocation): Location {
  return {
    uri: URI.file(path.resolve(root, location.file)).toString(),
    range: {
      start: {line: location.from.line, character: location.from.col},
      end: {line: location.to.line, character: location.to.col},
    },
  }
}

function toLocationLink(root: ProjectRoot, location: GrapheneLocation): LocationLink {
  let uri = URI.file(path.resolve(root, location.file)).toString()
  let range = {
    start: {line: location.from.line, character: location.from.col},
    end: {line: location.to.line, character: location.to.col},
  }
  return {targetUri: uri, targetRange: range, targetSelectionRange: range}
}
