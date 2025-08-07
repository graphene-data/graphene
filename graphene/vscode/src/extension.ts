import * as vscode from 'vscode';
import { registerSemanticTokens } from './semanticTokens';
import { activateDiagnostics } from './diagnostics';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [
    { language: 'gql', scheme: 'file' },
    { language: 'gql', scheme: 'untitled' },
    { language: 'gsql', scheme: 'file' },
    { language: 'gsql', scheme: 'untitled' }
  ];

  registerSemanticTokens(context, selector);
  activateDiagnostics(context, selector);
}

export function deactivate() {
  // no-op
}