import * as vscode from 'vscode';
import { activateDiagnostics } from './diagnostics';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [
    { language: 'gsql', scheme: 'file' },
    { language: 'gsql', scheme: 'untitled' }
  ];

  // If semantic tokens are needed again, import and register here
  // registerSemanticTokens(context, selector);
  activateDiagnostics(context, selector);

  console.log('[graphene] Extension activated');
  vscode.window.showInformationMessage('Graphene GSQL extension activated');

  const statusBar = vscode.window.createStatusBarItem('graphene.gsql', vscode.StatusBarAlignment.Left, 100);
  statusBar.name = 'Graphene GSQL';
  statusBar.text = '$(database) GSQL';
  statusBar.tooltip = 'Graphene GSQL language support active';
  context.subscriptions.push(statusBar);

  const updateStatus = () => {
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document.languageId === 'gsql') statusBar.show();
    else statusBar.hide();
  };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.workspace.onDidOpenTextDocument(() => updateStatus())
  );
  updateStatus();
}

export function deactivate() {
  // no-op
}
