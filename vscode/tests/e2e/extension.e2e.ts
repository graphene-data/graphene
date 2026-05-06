import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import path from 'node:path'
import * as vscode from 'vscode'

declare function suite(name: string, fn: () => void): void
declare function test(name: string, fn: () => void | Promise<void>): void

let workspaceRoot = process.env.GRAPHENE_VSCODE_E2E_WORKSPACE
if (!workspaceRoot) throw new Error('GRAPHENE_VSCODE_E2E_WORKSPACE is required')

let queryUri = vscode.Uri.file(path.join(workspaceRoot, 'query.gsql'))
let modelsUri = vscode.Uri.file(path.join(workspaceRoot, 'models.gsql'))
let flightsModelUri = vscode.Uri.file(path.join(workspaceRoot, 'flights-model.gsql'))
let aircraftModelUri = vscode.Uri.file(path.join(workspaceRoot, 'aircrafts.gsql'))

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

  test('clears diagnostics when a closed dependency model is restored on disk', async () => {
    await writeFile(
      flightsModelUri.fsPath,
      `
table flights (
  aircraft_id int
  join one aircrafts on aircrafts.id = aircraft_id
)
`.trimStart(),
    )
    await writeFile(aircraftModelUri.fsPath, 'table aircrafts (id int)\n')

    let flightsDocument = await vscode.workspace.openTextDocument(flightsModelUri)
    await vscode.window.showTextDocument(flightsDocument)
    await waitForDiagnostics(flightsModelUri, diagnostics => diagnostics.every(diagnostic => !/unknown table "aircrafts"/i.test(diagnostic.message)))

    let aircraftDocument = await vscode.workspace.openTextDocument(aircraftModelUri)
    await replaceDocument(aircraftDocument, '')
    assert.equal(await aircraftDocument.save(), true)
    await waitForDiagnostics(flightsModelUri, diagnostics => diagnostics.some(diagnostic => /unknown table "aircrafts"/i.test(diagnostic.message)))

    await closeDocument(aircraftDocument)
    await vscode.window.showTextDocument(flightsDocument)

    await writeFile(aircraftModelUri.fsPath, 'table aircrafts (id int)\n')
    await waitForDiagnostics(flightsModelUri, diagnostics => diagnostics.every(diagnostic => !/unknown table "aircrafts"/i.test(diagnostic.message)))
  })
})

async function replaceDocument(document: vscode.TextDocument, text: string) {
  let editor = await vscode.window.showTextDocument(document)
  let range = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
  assert.equal(
    await editor.edit(builder => {
      builder.replace(range, text)
    }),
    true,
  )
}

async function closeDocument(document: vscode.TextDocument) {
  await vscode.window.showTextDocument(document)
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
  await waitFor(() => !vscode.window.visibleTextEditors.some(editor => editor.document.uri.toString() == document.uri.toString()))
}

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

async function waitFor(ready: () => boolean) {
  let deadline = Date.now() + 1_800
  while (Date.now() < deadline) {
    if (ready()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.fail('Timed out waiting for VS Code state')
}
