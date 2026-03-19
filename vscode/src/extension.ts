import * as vscode from 'vscode'
import {LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind} from 'vscode-languageclient/node'

let client: LanguageClient
let showedErrorToast = false

export async function activate(context: vscode.ExtensionContext) {
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

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      {scheme: 'file', language: 'graphene-sql'},
      {scheme: 'file', language: 'markdown'},
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{md,gsql}'),
    },
  }

  client = new LanguageClient('graphene', 'Graphene', serverOptions, clientOptions)
  await client.start() // also launches the server

  client.onNotification('graphene/analyzeError', () => {
    if (!showedErrorToast) {
      showedErrorToast = true
      vscode.window.showWarningMessage('Graphene analyzer hit an internal error. See Output: Graphene Language Server.')
    }
  })
}

export function deactivate() {
  return client?.stop()
}
