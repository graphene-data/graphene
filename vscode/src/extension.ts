import * as path from 'path'
import * as vscode from 'vscode'
import {LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind} from 'vscode-languageclient/node'

let client: LanguageClient
let showedErrorToast = false

export function activate (context: vscode.ExtensionContext) {
  let module = context.asAbsolutePath(path.join('dist', 'server.js'))

  let serverOptions: ServerOptions = {
    run: {module, transport: TransportKind.ipc},
    debug: {module, transport: TransportKind.ipc},
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: 'file', language: 'gsql'}],
    // trace: {server: Trace.Verbose},
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.gsql'),
    },
  }

  client = new LanguageClient('graphene', 'Graphene', serverOptions, clientOptions)
  client.start() // also launches the server

  client.onNotification('graphene/analyzeError', () => {
    if (!showedErrorToast) {
      showedErrorToast = true
      vscode.window.showWarningMessage('Graphene analyzer hit an internal error. See Output: Graphene Language Server.')
    }
  })
}

export function deactivate () {
  if (client?.state === State.Running) {
    client?.stop()
  }
}
