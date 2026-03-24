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
  type WorkspaceDocumentDiagnosticReport,
  type DocumentUri,
  type Location,
  type LocationLink,
} from 'vscode-languageserver-protocol'
import {URI, Utils as URIs} from 'vscode-uri'

import {type Config} from '../../lang/config.ts'
import {analyzeProject, getDefinition, getFiles, getHover, getReferences, readConfig} from '../../lang/core.ts'
import {type AnalysisFileInput, type WorkspaceAnalysis, type GrapheneError, type Location as GrapheneLocation} from '../../lang/types.ts'
import {deleteWorkspaceFile, listWorkspaceFiles, loadWorkspaceFiles, toAnalysisOptions, updateWorkspaceFile} from '../../lang/workspace.ts'

export interface GrapheneProject {
  packageDir: string
  root: string
  config: Config
}

export async function discoverGrapheneProjects(workspaceFolders: readonly URI[]): Promise<GrapheneProject[]> {
  let projects = new Map<string, GrapheneProject>()

  for (let workspace of workspaceFolders) {
    let packagePaths = await glob('**/package.json', {cwd: workspace.fsPath, ignore: ['node_modules/**', '**/.*/**'], follow: false})
    for (let packagePath of packagePaths) {
      let absolutePackage = path.join(workspace.fsPath, packagePath)
      let parsed = await readPackageJson(absolutePackage)
      if (!parsed || parsed.graphene == null) continue

      let packageDir = path.dirname(absolutePackage)
      projects.set(packageDir, {packageDir, root: packageDir, config: readConfig(packageDir)})
    }
  }

  return [...projects.values()].sort((a, b) => b.root.length - a.root.length || a.root.localeCompare(b.root))
}

export function findOwningProject<T extends {root: string}>(projects: readonly T[], fsPath: string): T | null {
  return projects.find(project => containsPath(project.root, fsPath)) || null
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
      let registry = createProjectRegistry(server, context.env.workspaceFolders)

      return {
        dispose() {
          registry.dispose()
        },
        async provideHover(document, position) {
          let project = await registry.projectForUri(document.uri)
          return project ? project.provideHover(document.uri, position.line, position.character) : null
        },
        async provideDefinition(document, position, _token) {
          let project = await registry.projectForUri(document.uri)
          return project ? project.provideDefinition(document.uri, position.line, position.character) : []
        },
        async provideReferences(document, position, context, _token) {
          let project = await registry.projectForUri(document.uri)
          return project ? project.provideReferences(document.uri, position.line, position.character, context.includeDeclaration) : []
        },
        async provideDiagnostics(document) {
          let project = await registry.projectForUri(document.uri)
          return project ? project.provideDiagnostics(document.uri) : []
        },
        async provideWorkspaceDiagnostics() {
          await registry.pending
          return registry.workspaceDiagnostics()
        },
      }
    },
  }
}

// The registry owns shared watchers and routes requests to the nearest project analysis.
function createProjectRegistry(server: ReturnType<typeof createServer>, workspaceFolders: readonly URI[]) {
  let disposed = false
  let projects: GrapheneProjectAnalysis[] = []
  let fileWatcher: Disposable | undefined
  let changeWatchedFiles: Disposable | undefined
  let changeContent: Disposable | undefined
  let ready = discoverGrapheneProjects(workspaceFolders).then(discovered => {
    let created = discovered.map(project => createProjectAnalysis(server, project))
    if (disposed) created.forEach(project => project.dispose())
    else projects = created

    console.log(
      'started Graphene language server',
      created.map(project => project.root),
    )
  })

  server.onInitialized(async () => {
    fileWatcher = await server.fileWatcher.watchFiles(['**/*.{md,gsql}'])
  })

  changeWatchedFiles = server.fileWatcher.onDidChangeWatchedFiles(({changes}) => {
    ready.then(async () => {
      for (let change of changes) {
        let project = projectForFsPath(filePathFromUri(change.uri))
        if (project) await project.handleWatchedFileChange(change.uri, change.type)
      }
    })
  })

  changeContent = server.documents.onDidChangeContent(({document}) => {
    ready.then(() => {
      let project = projectForFsPath(filePathFromUri(document.uri))
      project?.handleDocumentChange(document.uri, document.getText())
    })
  })

  return {
    get pending() {
      return ready.then(() => Promise.all(projects.map(project => project.pending)).then(() => undefined))
    },
    async projectForUri(uri: DocumentUri) {
      await ready
      let project = projectForFsPath(filePathFromUri(uri))
      if (!project) return null
      await project.pending
      return project
    },
    workspaceDiagnostics() {
      return projects.flatMap(project => project.workspaceDiagnostics())
    },
    dispose() {
      disposed = true
      fileWatcher?.dispose()
      changeWatchedFiles?.dispose()
      changeContent?.dispose()
      projects.forEach(project => project.dispose())
    },
  }

  function projectForFsPath(fsPath: string | null) {
    return fsPath ? findOwningProject(projects, fsPath) : null
  }
}

interface GrapheneProjectAnalysis {
  root: string
  pending: Promise<void>
  provideHover(uri: DocumentUri, line: number, col: number): {contents: string} | null
  provideDefinition(uri: DocumentUri, line: number, col: number): LocationLink[]
  provideReferences(uri: DocumentUri, line: number, col: number, includeDeclaration: boolean): Location[]
  provideDiagnostics(uri: DocumentUri): Diagnostic[]
  workspaceDiagnostics(): WorkspaceDocumentDiagnosticReport[]
  handleWatchedFileChange(uri: DocumentUri, changeType: FileChangeType): Promise<void>
  handleDocumentChange(uri: DocumentUri, contents: string): void
  dispose(): void
}

// Each project analysis owns its files, scheduler, and URI mapping.
function createProjectAnalysis(server: ReturnType<typeof createServer>, project: GrapheneProject): GrapheneProjectAnalysis {
  let files: Record<string, AnalysisFileInput> = {}
  let result: WorkspaceAnalysis = {files: {}, diagnostics: [], queries: []}
  let ignoredFiles = project.config.ignoredFiles || []
  let analysis = createWorkspaceAnalysis({
    load: () =>
      loadWorkspaceFiles(project.root, true, ignoredFiles).then(loaded => {
        files = loaded
      }),
    analyze: tryAnalyze,
    delay: 200,
  })

  return {
    root: project.root,
    get pending() {
      return analysis.pending
    },
    provideHover(uri, line, col) {
      let filePath = projectPath(uri)
      if (!filePath) return null
      return {contents: getHover(result, filePath, line, col)}
    },
    provideDefinition(uri, line, col) {
      let filePath = projectPath(uri)
      let location = filePath ? getDefinition(result, filePath, line, col) : null
      return location ? [toLocationLink(project.root, location)] : []
    },
    provideReferences(uri, line, col, includeDeclaration) {
      let filePath = projectPath(uri)
      return filePath ? getReferences(result, filePath, line, col, includeDeclaration).map(location => toLocation(project.root, location)) : []
    },
    provideDiagnostics(uri) {
      let filePath = projectPath(uri)
      return filePath ? diagnosticsFor(filePath) : []
    },
    workspaceDiagnostics() {
      return getFiles(result).map(file => {
        return {
          kind: DocumentDiagnosticReportKind.Full,
          uri: URIs.joinPath(URI.file(project.root), file.path).toString(),
          version: null,
          items: diagnosticsFor(file.path),
        }
      }) satisfies WorkspaceDocumentDiagnosticReport[]
    },
    async handleWatchedFileChange(uri, changeType) {
      let filePath = projectPath(uri)
      if (!filePath || isIgnoredWorkspacePath(filePath, ignoredFiles)) return

      if (changeType === FileChangeType.Deleted) {
        deleteWorkspaceFile(files, filePath)
        analysis.invalidate()
        return
      }

      let document = server.documents.get(URI.parse(uri))
      if (document) {
        updateWorkspaceFile(files, document.getText(), filePath, contentType(filePath))
      } else {
        try {
          updateWorkspaceFile(files, await readFile(filePathFromUri(uri)!, 'utf-8'), filePath, contentType(filePath))
        } catch (err) {
          let message = err instanceof Error ? err.message : String(err)
          console.error(`Failed to refresh ${uri}: ${message}`)
          return
        }
      }

      analysis.invalidate()
    },
    handleDocumentChange(uri, contents) {
      let filePath = projectPath(uri)
      if (!filePath || isIgnoredWorkspacePath(filePath, ignoredFiles)) return

      updateWorkspaceFile(files, contents, filePath, contentType(filePath))
      analysis.invalidate()
    },
    dispose() {
      analysis.dispose()
    },
  }

  async function tryAnalyze() {
    try {
      result = analyzeProject({files: listWorkspaceFiles(files), options: toAnalysisOptions(project.config)})
      await server.languageFeatures.requestRefresh(false)
    } catch (err) {
      let message = err instanceof Error ? err.stack || err.message : String(err)
      console.error(`Analyze failed for ${project.root}: ${message}`)
    }
  }

  function projectPath(uri: DocumentUri): string | null {
    let fsPath = filePathFromUri(uri)
    if (!fsPath) return null
    return toWorkspacePath(project.root, fsPath)
  }

  function diagnosticsFor(filePath: string) {
    return result.diagnostics.filter(diagnostic => diagnostic.file === filePath).map(toDiagnostic)
  }
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

async function readPackageJson(packagePath: string) {
  try {
    return JSON.parse(await readFile(packagePath, 'utf-8'))
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to read ${packagePath}: ${message}`)
    return null
  }
}

function containsPath(root: string, fsPath: string) {
  let relative = path.relative(root, fsPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function filePathFromUri(uri: DocumentUri): string | null {
  let parsed = URI.parse(uri)
  return parsed.scheme === 'file' ? parsed.fsPath : null
}

function toWorkspacePath(root: string, fsPath: string): string | null {
  if (!containsPath(root, fsPath)) return null
  return path.relative(root, fsPath).replace(/\\/g, '/')
}

function isIgnoredWorkspacePath(filePath: string, ignoredFiles: string[]) {
  let parts = filePath.split('/')
  if (parts.includes('node_modules')) return true
  if (parts.some(part => part.startsWith('.'))) return true
  return ignoredFiles.some(pattern => path.posix.matchesGlob(filePath, pattern))
}

function contentType(filePath: string): 'md' | 'gsql' {
  return filePath.endsWith('.md') ? 'md' : 'gsql'
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

function toLocation(root: string, location: GrapheneLocation): Location {
  return {
    uri: URIs.joinPath(URI.file(root), location.file).toString(),
    range: {
      start: {line: location.from.line, character: location.from.col},
      end: {line: location.to.line, character: location.to.col},
    },
  }
}

function toLocationLink(root: string, location: GrapheneLocation): LocationLink {
  let uri = URIs.joinPath(URI.file(root), location.file).toString()
  let range = {
    start: {line: location.from.line, character: location.from.col},
    end: {line: location.to.line, character: location.to.col},
  }
  return {targetUri: uri, targetRange: range, targetSelectionRange: range}
}
