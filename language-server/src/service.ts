import {type createServer} from '@volar/language-server/node.js'
import {type LanguageServicePlugin, type LanguageServicePluginInstance} from '@volar/language-service'
import {relative as relativePath} from 'node:path'
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

import {config, loadConfig} from '../../lang/config.ts'
import {analyzeWorkspace, getDefinition, getDiagnostics, getFiles, getHover, getReferences, loadWorkspace} from '../../lang/core.ts'
import {type AnalysisResult, type GrapheneError, type Location as GrapheneLocation, type WorkspaceFileInput} from '../../lang/types.ts'

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
      let [workspace] = context.env.workspaceFolders
      let workspaceFiles: WorkspaceFileInput[] = []
      let analysisResult: AnalysisResult = {files: [], diagnostics: []}
      let analysis = createWorkspaceAnalysis({
        load: () => {
          loadConfig(workspace.fsPath)
          return loadWorkspace(workspace.fsPath, true, config.ignoredFiles).then(files => {
            workspaceFiles = files
          })
        },
        analyze: tryAnalyze,
        delay: 200,
      })
      let workspaceWatcher = watchWorkspace()

      console.log('started Graphene language server', workspace.fsPath)

      return {
        dispose() {
          analysis.dispose()
          workspaceWatcher.dispose()
        },
        async provideHover(document, position) {
          await analysis.pending

          let path = workspacePath(document.uri)
          return path ? {contents: getHover(analysisResult, path, position.line, position.character)} : null
        },
        async provideDefinition(document, position, _token) {
          await analysis.pending

          let path = workspacePath(document.uri)
          let location = path ? getDefinition(analysisResult, path, position.line, position.character) : null
          return location ? [toLocationLink(workspace, location)] : []
        },
        async provideReferences(document, position, context, _token) {
          await analysis.pending

          let path = workspacePath(document.uri)
          return path ? getReferences(analysisResult, path, position.line, position.character, context.includeDeclaration).map(location => toLocation(workspace, location)) : []
        },
        async provideDiagnostics(document) {
          await analysis.pending

          let path = workspacePath(document.uri)
          return path ? diagnosticsFor(path) : []
        },
        async provideWorkspaceDiagnostics() {
          await analysis.pending
          return workspaceDiagnostics()
        },
      }

      function workspacePath(uri: DocumentUri): string | null {
        let parsed = URI.parse(uri)
        if (parsed.scheme !== 'file') return null
        return relativePath(workspace.fsPath, parsed.fsPath)
      }

      function watchWorkspace(): Disposable {
        let fileWatcher: Disposable | undefined
        let changeWatchedFiles: Disposable | undefined
        let changeContent: Disposable | undefined

        server.onInitialized(async () => {
          fileWatcher = await server.fileWatcher.watchFiles(['**/*.{md,gsql}'])
        })

        changeWatchedFiles = server.fileWatcher.onDidChangeWatchedFiles(({changes}) => {
          for (let change of changes) {
            let path = workspacePath(change.uri)
            if (!path) continue

            if (change.type === FileChangeType.Deleted) {
              workspaceFiles = workspaceFiles.filter(file => file.path != path)
            } else {
              let document = server.documents.get(URI.parse(change.uri))
              if (document) workspaceFiles = upsertFile(workspaceFiles, {path, contents: document.getText()})
            }
          }

          analysis.invalidate()
        })

        changeContent = server.documents.onDidChangeContent(({document}) => {
          let path = workspacePath(document.uri)
          if (!path) return
          workspaceFiles = upsertFile(workspaceFiles, {path, contents: document.getText()})
          analysis.invalidate()
        })

        return {
          dispose() {
            fileWatcher?.dispose()
            changeWatchedFiles?.dispose()
            changeContent?.dispose()
          },
        }
      }

      async function tryAnalyze() {
        try {
          analysisResult = analyzeWorkspace({config, files: workspaceFiles})
          workspaceFiles = updateParsedFiles(workspaceFiles, analysisResult)
          await server.languageFeatures.requestRefresh(false)
        } catch (err) {
          let message = err instanceof Error ? err.stack || err.message : String(err)
          console.error(`Analyze failed: ${message}`)
        }
      }

      function diagnosticsFor(path: string) {
        return getDiagnostics(analysisResult)
          .filter(diagnostic => diagnostic.file === path)
          .map(toDiagnostic)
      }

      function workspaceDiagnostics() {
        return getFiles(analysisResult).map(file => {
          return {
            kind: DocumentDiagnosticReportKind.Full,
            uri: URIs.joinPath(workspace, file.path).toString(),
            version: null,
            items: diagnosticsFor(file.path),
          }
        }) satisfies WorkspaceDocumentDiagnosticReport[]
      }
    },
  }
}

function upsertFile(files: WorkspaceFileInput[], next: WorkspaceFileInput) {
  let idx = files.findIndex(file => file.path == next.path)
  if (idx < 0) return [...files, next]
  return files.map((file, fileIdx) => (fileIdx == idx ? next : file))
}

function updateParsedFiles(files: WorkspaceFileInput[], result: AnalysisResult) {
  return files.map(file => {
    let analyzed = result.files.find(next => next.path == file.path)
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

function toLocation(workspace: URI, location: GrapheneLocation): Location {
  return {
    uri: URIs.joinPath(workspace, location.file).toString(),
    range: {
      start: {line: location.from.line, character: location.from.col},
      end: {line: location.to.line, character: location.to.col},
    },
  }
}

function toLocationLink(workspace: URI, location: GrapheneLocation): LocationLink {
  let uri = URIs.joinPath(workspace, location.file).toString()
  let range = {
    start: {line: location.from.line, character: location.from.col},
    end: {line: location.to.line, character: location.to.col},
  }
  return {targetUri: uri, targetRange: range, targetSelectionRange: range}
}
