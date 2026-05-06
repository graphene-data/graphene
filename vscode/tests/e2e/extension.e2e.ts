import assert from 'node:assert/strict'
import path from 'node:path'
import * as vscode from 'vscode'

declare function suite(name: string, fn: () => void): void
declare function test(name: string, fn: () => void | Promise<void>): void

let workspaceRoot = process.env.GRAPHENE_VSCODE_E2E_WORKSPACE
if (!workspaceRoot) throw new Error('GRAPHENE_VSCODE_E2E_WORKSPACE is required')

let queryUri = vscode.Uri.file(path.join(workspaceRoot, 'query.gsql'))
let modelsUri = vscode.Uri.file(path.join(workspaceRoot, 'models.gsql'))

suite('Graphene VS Code extension', () => {
  test('activates for gsql files', async () => {
    let document = await vscode.workspace.openTextDocument(queryUri)
    await vscode.window.showTextDocument(document)

    assert.equal(document.languageId, 'graphene-sql')

    let extension = vscode.extensions.getExtension('graphene-data.graphene-data-vscode')
    assert.ok(extension, 'Graphene extension should be installed in the extension host')

    await extension.activate()
    assert.equal(extension.isActive, true)
  })

  test('updates diagnostics when workspace gsql files change', async () => {
    await vscode.workspace.openTextDocument(queryUri)

    await waitForDiagnostics(queryUri, diagnostics => diagnostics.some(diagnostic => /unknown table "users"/i.test(diagnostic.message)))

    await vscode.workspace.fs.writeFile(modelsUri, new TextEncoder().encode('table users (id int)\n'))
    await waitForDiagnostics(queryUri, diagnostics => diagnostics.every(diagnostic => !/unknown table "users"/i.test(diagnostic.message)))

    await vscode.workspace.fs.delete(modelsUri)
    await waitForDiagnostics(queryUri, diagnostics => diagnostics.some(diagnostic => /unknown table "users"/i.test(diagnostic.message)))
  })
})

async function waitForDiagnostics(uri: vscode.Uri, ready: (diagnostics: readonly vscode.Diagnostic[]) => boolean) {
  let deadline = Date.now() + 1_800

  while (Date.now() < deadline) {
    let diagnostics = vscode.languages.getDiagnostics(uri)
    if (ready(diagnostics)) return diagnostics
    await new Promise<void>(resolve => {
      let disposable = vscode.languages.onDidChangeDiagnostics(event => {
        if (!event.uris.some(changed => changed.toString() == uri.toString())) return
        disposable.dispose()
        resolve()
      })
      setTimeout(() => {
        disposable.dispose()
        resolve()
      }, 50)
    })
  }

  let messages = vscode.languages
    .getDiagnostics(uri)
    .map(diagnostic => diagnostic.message)
    .join('\n')
  assert.fail(`Timed out waiting for diagnostics on ${uri.toString()}\n${messages || 'No diagnostics.'}`)
}
