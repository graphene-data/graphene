import * as vscode from 'vscode';

function collectDiagnosticsStub(text: string): Array<{ message: string; start: number; end: number; severity: vscode.DiagnosticSeverity }> {
  const diagnostics: Array<{ message: string; start: number; end: number; severity: vscode.DiagnosticSeverity }> = [];

  // Very naive: warn on FIXME/TODO and on unbalanced braces
  for (const match of text.matchAll(/\b(FIXME|TODO)\b/g)) {
    diagnostics.push({ message: `Note: ${match[1]}`, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, severity: vscode.DiagnosticSeverity.Information });
  }

  const stack: Array<{ ch: string; index: number }> = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') stack.push({ ch, index: i });
    else if (ch === '}' || ch === ')' || ch === ']') {
      if (!stack.length) {
        diagnostics.push({ message: `Unmatched closing '${ch}'`, start: i, end: i + 1, severity: vscode.DiagnosticSeverity.Error });
      } else {
        const open = stack.pop()!;
        const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
        if (pairs[open.ch] !== ch) {
          diagnostics.push({ message: `Mismatched '${open.ch}' ... '${ch}'`, start: open.index, end: i + 1, severity: vscode.DiagnosticSeverity.Error });
        }
      }
    }
  }
  for (const leftover of stack) {
    diagnostics.push({ message: `Unclosed '${leftover.ch}'`, start: leftover.index, end: leftover.index + 1, severity: vscode.DiagnosticSeverity.Error });
  }

  return diagnostics;
}

export function activateDiagnostics(context: vscode.ExtensionContext, selector: vscode.DocumentSelector) {
  const collection = vscode.languages.createDiagnosticCollection('graphene');
  context.subscriptions.push(collection);

  const refresh = (document: vscode.TextDocument) => {
    if (!vscode.languages.match(selector, document)) return;

    const diags: vscode.Diagnostic[] = [];
    const text = document.getText();
    for (const d of collectDiagnosticsStub(text)) {
      const start = document.positionAt(d.start);
      const end = document.positionAt(d.end);
      const range = new vscode.Range(start, end);
      diags.push(new vscode.Diagnostic(range, d.message, d.severity));
    }

    collection.set(document.uri, diags);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument(e => refresh(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
  );

  // Initialize already-open documents
  vscode.workspace.textDocuments.forEach(refresh);
}