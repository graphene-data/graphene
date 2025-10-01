/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  type Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node'

import {TextDocument} from 'vscode-languageserver-textdocument'
import {readFile} from 'node:fs/promises'
import {loadWorkspace, updateFile, analyze, getDiagnostics, getFiles, getHover, loadConfig} from '@graphenedata/lang'

const connection = createConnection(ProposedFeatures.all)
let initialLoad: Promise<void> | undefined

connection.onInitialize(params => {
  let dirs = params.workspaceFolders?.map(f => f.uri) || []
  console.log('started Graphene server', dirs)
  let root = dirs[0].replace('file://', '')
  loadConfig(root)
  initialLoad = dirs[0] ? loadWorkspace(root, true) : Promise.resolve()

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {resolveProvider: false},
      hoverProvider: true,
      // diagnosticProvider: {interFileDependencies: true, workspaceDiagnostics: true},
    },
  }
})

// TextDocument.onDidChangeContent listens for buffer changes (even if the user hasn't saved the file yet)
const documents = new TextDocuments(TextDocument)
documents.onDidChangeContent(change => {
  updateFile(change.document.getText(), toPath(change.document.uri))
  debouncedAnalyze()
})
documents.listen(connection)

// onDidChangeWatchedFiles listens for file changes, even if they happend outside the editor
connection.onDidChangeWatchedFiles(async change => {
  await Promise.all(change.changes.map(async c => {
    let contents = await readFile(toPath(c.uri), 'utf-8')
    updateFile(contents, toPath(c.uri))
  }))
  debouncedAnalyze()
})

let handle: NodeJS.Timeout | undefined
function debouncedAnalyze () {
  if (handle) clearTimeout(handle)
  handle = setTimeout(analyzeNow, 200)
}

async function analyzeNow () {
  await initialLoad
  try {
    analyze()
    perFileVscodeDiagnostics().forEach(d => connection.sendDiagnostics(d))
  } catch (err) {
    let message = (err instanceof Error ? (err.stack || err.message) : String(err))
    connection.console.error(`Analyze failed: ${message}`)
    connection.sendNotification('graphene/analyzeError', {message})
  }
  // connection.languages.diagnostics.refresh()
}

// VSCode in theory has a pull api that allows it to get all diagnostics for the whole workspace at once.
// This would be nice for us, since Graphene has cross-file dependencies, but for whatever reason I don't see red squiggles when using it.
// connection.languages.diagnostics.onWorkspace(() => {
//   return {items: perFileVscodeDiagnostics().map(f => {
//     return {
//       kind: DocumentDiagnosticReportKind.Full,
//       uri: f.uri,
//       version: 1,
//       items: f.diagnostics,
//     }
//   })}
// })

// Group diagnostics by file, and translate them to VSCode's format.
function perFileVscodeDiagnostics () {
  let diags = getDiagnostics()
  return getFiles().map(f => {
    let diagnostics: Diagnostic[] = diags.filter(d => d.file == f.path).map(d => {
      return {
        range: {
          start: {line: d.from.line, character: d.from.col},
          end: {line: d.to.line, character: d.to.col},
        },
        severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
        message: d.message,
        source: 'graphene',
      }
    })
    return {uri: `file://${f.path}`, diagnostics}
  })
}

function toPath (uri: string) {
  return decodeURIComponent(uri.replace('file://', ''))
}

connection.onHover(params => {
  console.log('hover', params)
  let hover = getHover(toPath(params.textDocument.uri), params.position.line, params.position.character)
  return {contents: hover}
})

// // This handler provides the initial list of the completion items.
// connection.onCompletion(
//   (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
//     // The pass parameter contains the position of the text document in
//     // which code complete got requested. For the example we ignore this
//     // info and always provide the same completion items.
//     return [
//       {
//         label: 'TypeScript',
//         kind: CompletionItemKind.Text,
//         data: 1,
//       },
//       {
//         label: 'JavaScript',
//         kind: CompletionItemKind.Text,
//         data: 2,
//       },
//     ]
//   },
// )

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
//   (item: CompletionItem): CompletionItem => {
//     if (item.data === 1) {
//       item.detail = 'TypeScript details'
//       item.documentation = 'TypeScript documentation'
//     } else if (item.data === 2) {
//       item.detail = 'JavaScript details'
//       item.documentation = 'JavaScript documentation'
//     }
//     return item
//   },
// )

connection.listen()
