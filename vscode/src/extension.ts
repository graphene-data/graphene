import * as vscode from 'vscode';
import { activateDiagnostics } from './diagnostics';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { getCompletions } from '@graphene/lang/autocomplete';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore esbuild alias maps to '../../lang/autocomplete.ts'
import { getCompletions } from '@graphene/lang/autocomplete';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [
    { language: 'gsql', scheme: 'file' },
    { language: 'gsql', scheme: 'untitled' }
  ];

  // If semantic tokens are needed again, import and register here
  // registerSemanticTokens(context, selector);
  activateDiagnostics(context, selector);

  // Register completion provider backed by shared autocomplete
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(document, position) {
          const text = document.getText();
          const items = getCompletions(text, position.line, position.character);
          return items.map(i => {
            const kind = i.kind === 'table'
              ? vscode.CompletionItemKind.Struct
              : i.kind === 'join'
                ? vscode.CompletionItemKind.Interface
                : vscode.CompletionItemKind.Field;
            const ci = new vscode.CompletionItem(i.label, kind);
            return ci;
          });
        }
      },
      '.'
    )
  );

  // Register completion provider backed by shared autocomplete
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(document, position) {
          const text = document.getText();
          const items = getCompletions(text, position.line, position.character);
          return items.map(i => {
            const kind = i.kind === 'table'
              ? vscode.CompletionItemKind.Struct
              : i.kind === 'join'
                ? vscode.CompletionItemKind.Interface
                : vscode.CompletionItemKind.Field;
            const ci = new vscode.CompletionItem(i.label, kind);
            return ci;
          });
        }
      },
      '.'
    )
  );

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