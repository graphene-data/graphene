import * as vscode from 'vscode'
import {LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind} from 'vscode-languageclient/node'

let client: LanguageClient | undefined
let showedErrorToast = false

export async function activate(context: vscode.ExtensionContext) {
  let output = vscode.window.createOutputChannel('Graphene Extension')
  context.subscriptions.push(output)
  output.appendLine('Activating Graphene extension')

  let {fsPath: module} = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.js')

  let serverOptions: ServerOptions = {
    run: {
      module,
      transport: TransportKind.ipc,
      options: {execArgv: []},
    },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {execArgv: ['--nolazy', '--inspect=' + 6009]},
    },
  }

  let gsqlWatcher = vscode.workspace.createFileSystemWatcher('**/*.gsql')
  let mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.md')
  context.subscriptions.push(gsqlWatcher, mdWatcher)

  logWatcher(output, gsqlWatcher, 'gsql')
  logWatcher(output, mdWatcher, 'md')

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      {scheme: 'file', language: 'graphene-sql'},
      {scheme: 'file', language: 'markdown'},
    ],
    synchronize: {
      fileEvents: [gsqlWatcher, mdWatcher],
    },
    middleware: {
      workspace: {
        didChangeWatchedFile(event: any, next: any) {
          output.appendLine(`[language-client] forwarding watched file ${event.type} ${event.uri}`)
          return next(event)
        },
      },
    },
  }

  client = new LanguageClient('graphene', 'Graphene', serverOptions, clientOptions)
  await client.start() // also launches the server
  output.appendLine('Graphene language client started')

  client.onNotification('graphene/analyzeError', () => {
    if (!showedErrorToast) {
      showedErrorToast = true
      vscode.window.showWarningMessage('Graphene analyzer hit an internal error. See Output: Graphene Language Server.')
    }
  })
}

function logWatcher(output: vscode.OutputChannel, watcher: vscode.FileSystemWatcher, label: string) {
  watcher.onDidCreate(uri => handleFileEvent(output, label, 'create', uri, 1))
  watcher.onDidChange(uri => handleFileEvent(output, label, 'change', uri, 2))
  watcher.onDidDelete(uri => handleFileEvent(output, label, 'delete', uri, 3))
}

function handleFileEvent(output: vscode.OutputChannel, label: string, action: string, uri: vscode.Uri, type: 1 | 2 | 3) {
  output.appendLine(`[watcher:${label}] ${action} ${uri.fsPath}`)

  if (!client) {
    output.appendLine(`[manual-forward] skipped because language client is not started ${uri.fsPath}`)
    return
  }

  output.appendLine(`[manual-forward] workspace/didChangeWatchedFiles ${action} ${uri.toString()}`)
  void client.sendNotification('workspace/didChangeWatchedFiles', {changes: [{uri: uri.toString(), type}]}).catch(err => {
    output.appendLine(`[manual-forward] failed ${err instanceof Error ? err.stack || err.message : String(err)}`)
  })
}

export function deactivate() {
  return client?.stop()
}
