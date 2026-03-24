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

import {analyzeProject, getDefinition, getFiles, getHover, getReferences, loadConfig} from '../../lang/core.ts'
import {type AnalysisFileInput, type WorkspaceAnalysis, type GrapheneError, type Location as GrapheneLocation} from '../../lang/types.ts'
import {deleteWorkspaceFile, listWorkspaceFiles, loadWorkspaceFiles, toAnalysisOptions, updateWorkspaceFile} from '../../lang/workspace.ts'

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
      let files: Record<string, AnalysisFileInput> = {}
      let result: WorkspaceAnalysis = {files: {}, diagnostics: [], queries: []}
      let analysis = createWorkspaceAnalysis({
        load: () => {
          loadConfig(workspace.fsPath)
          return loadWorkspaceFiles(workspace.fsPath, true).then(loaded => {
            files = loaded
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
          return path ? {contents: getHover(result, path, position.line, position.character)} : null
        },
        async provideDefinition(document, position, _token) {
          await analysis.pending

          let path = workspacePath(document.uri)
          let location = path ? getDefinition(result, path, position.line, position.character) : null
          return location ? [toLocationLink(workspace, location)] : []
        },
        async provideReferences(document, position, context, _token) {
          await analysis.pending

          let path = workspacePath(document.uri)
          return path ? getReferences(result, path, position.line, position.character, context.includeDeclaration).map(location => toLocation(workspace, location)) : []
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
        if (parsed.scheme === 'file') {
          return relativePath(workspace.fsPath, parsed.fsPath)
        } else {
          return null
        }
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
              deleteWorkspaceFile(files, path)
            } else {
              let document = server.documents.get(URI.parse(change.uri))
              if (document) {
                updateWorkspaceFile(files, document.getText(), path, path.endsWith('.md') ? 'md' : 'gsql')
              }
            }
          }

          analysis.invalidate()
        })

        changeContent = server.documents.onDidChangeContent(({document}) => {
          let path = workspacePath(document.uri)
          if (path) {
            updateWorkspaceFile(files, document.getText(), path, path.endsWith('.md') ? 'md' : 'gsql')
            analysis.invalidate()
          }
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
          result = analyzeProject({files: listWorkspaceFiles(files), options: toAnalysisOptions()})
          await server.languageFeatures.requestRefresh(false)
        } catch (err) {
          let message = err instanceof Error ? err.stack || err.message : String(err)
          console.error(`Analyze failed: ${message}`)
        }
      }

      function diagnosticsFor(path: string) {
        return result.diagnostics.filter(diagnostic => diagnostic.file === path).map(toDiagnostic)
      }

      function workspaceDiagnostics() {
        return getFiles(result).map(file => {
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
