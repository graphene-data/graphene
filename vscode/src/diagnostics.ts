import * as vscode from 'vscode';
// esbuild alias resolves this to '../../lang/analyze.ts' at bundle time
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { analyze } from '@graphene/lang/analyze';

type RawDiagnostic = { message: string; from: number; to: number; severity: vscode.DiagnosticSeverity };

async function collectDiagnostics(text: string): Promise<RawDiagnostic[]> {
  console.log('collectDiagnostics');
  try {
    const { tables, queries } = analyze(text);
    const all = [
      ...tables.flatMap((t: any) => t.diagnostics || []),
      ...queries.flatMap((q: any) => q.diagnostics || []),
    ];
    console.log('all', all);
    return all.map((d: any) => ({
      message: d.message,
      from: d.from,
      to: d.to,
      severity: d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    }));
  } catch (e) {
    console.error('Error collecting diagnostics', e);
    return [];
  }
}

export function activateDiagnostics(context: vscode.ExtensionContext, selector: vscode.DocumentSelector) {
  const collection = vscode.languages.createDiagnosticCollection('graphene');
  context.subscriptions.push(collection);

  const debounceHandles = new Map<string, ReturnType<typeof setTimeout>>();

  const refreshNow = async (document: vscode.TextDocument) => {
    if (!vscode.languages.match(selector, document)) return;

    const text = document.getText();
    const raw = await collectDiagnostics(text);
    const diags = raw.map(d => {
      const range = new vscode.Range(document.positionAt(d.from), document.positionAt(d.to));
      const diag = new vscode.Diagnostic(range, d.message, d.severity);
      diag.source = 'graphene';
      return diag;
    });
    collection.set(document.uri, diags);
  };

  const refreshDebounced = (document: vscode.TextDocument, delayMs = 200) => {
    if (!vscode.languages.match(selector, document)) return;
    const key = document.uri.toString();
    const existing = debounceHandles.get(key);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      debounceHandles.delete(key);
      void refreshNow(document);
    }, delayMs);
    debounceHandles.set(key, handle);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => void refreshNow(doc)),
    vscode.workspace.onDidChangeTextDocument(e => refreshDebounced(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => {
      const key = doc.uri.toString();
      const existing = debounceHandles.get(key);
      if (existing) clearTimeout(existing);
      debounceHandles.delete(key);
      collection.delete(doc.uri);
    })
  );

  // Initialize already-open documents
  for (const doc of vscode.workspace.textDocuments) {
    void refreshNow(doc);
  }
}
