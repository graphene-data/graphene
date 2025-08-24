import * as path from 'path'
import {workspace, ExtensionContext} from 'vscode'
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient/node'

let client: LanguageClient

export function activate (context: ExtensionContext) {
  let module = context.asAbsolutePath(path.join('out', 'server.js'))

  let serverOptions: ServerOptions = {
    run: {module, transport: TransportKind.ipc},
    debug: {module, transport: TransportKind.ipc},
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: 'file', language: 'gsql'}],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.gsql'),
    },
  }

  console.log('activating client')
  client = new LanguageClient('graphene', 'Graphene', serverOptions, clientOptions)
  client.start() // also launches the server


  // activateDiagnostics(context, selector)

  // console.log('[graphene] Extension activated')
  // vscode.window.showInformationMessage('Graphene GSQL extension activated')

  // let statusBar = vscode.window.createStatusBarItem('graphene.gsql', vscode.StatusBarAlignment.Left, 100)
  // statusBar.name = 'Graphene GSQL'
  // statusBar.text = '$(database) GSQL'
  // statusBar.tooltip = 'Graphene GSQL language support active'
  // context.subscriptions.push(statusBar)

  // let updateStatus = () => {
  //   let ed = vscode.window.activeTextEditor
  //   if (ed && ed.document.languageId === 'gsql') statusBar.show()
  //   else statusBar.hide()
  // }
  // context.subscriptions.push(
  //   vscode.window.onDidChangeActiveTextEditor(updateStatus),
  //   vscode.workspace.onDidOpenTextDocument(() => updateStatus()),
  // )
  // updateStatus()
}

export function deactivate () {
  client?.stop()
}
