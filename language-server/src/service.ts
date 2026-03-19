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
} from 'vscode-languageserver-protocol'
import {URI, Utils as URIs} from 'vscode-uri'

import {deleteFile, updateFile, analyze, getDiagnostics, getFiles, getHover, loadConfig, loadWorkspace} from '../../lang/core.ts'
import {type Diagnostic as GrapheneDiagnostic} from '../../lang/types.ts'

export function createGrapheneService(server: ReturnType<typeof createServer>): LanguageServicePlugin {
  return {
    name: 'graphene',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: true,
        workspaceDiagnostics: true,
      },
      hoverProvider: true,
    },
    create(context): LanguageServicePluginInstance {
      let [workspace] = context.env.workspaceFolders
      let analysis = createWorkspaceAnalysis({
        load: () => {
          loadConfig(workspace.fsPath)
          return loadWorkspace(workspace.fsPath, true)
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
          return path ? {contents: getHover(path, position.line, position.character)} : null
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
              deleteFile(path)
            } else {
              let document = server.documents.get(URI.parse(change.uri))
              if (document) {
                updateFile(document.getText(), path)
              }
            }
          }

          analysis.invalidate()
        })

        changeContent = server.documents.onDidChangeContent(({document}) => {
          let path = workspacePath(document.uri)
          if (path) {
            updateFile(document.getText(), path)
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
          analyze()
          await server.languageFeatures.requestRefresh(false)
        } catch (err) {
          let message = err instanceof Error ? err.stack || err.message : String(err)
          console.error(`Analyze failed: ${message}`)
        }
      }

      function diagnosticsFor(path: string) {
        return getDiagnostics()
          .filter(diagnostic => diagnostic.file === path)
          .map(toDiagnostic)
      }

      function workspaceDiagnostics() {
        return getFiles().map(file => {
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

function toDiagnostic(diagnostic: GrapheneDiagnostic): Diagnostic {
  return {
    range: {
      start: {line: diagnostic.from.line, character: diagnostic.from.col},
      end: {line: diagnostic.to.line, character: diagnostic.to.col},
    },
    severity: diagnostic.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    message: diagnostic.message,
    source: 'graphene',
  }
}
