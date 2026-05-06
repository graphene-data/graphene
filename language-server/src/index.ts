import {
  createConnection,
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  FileChangeType,
  ProposedFeatures,
  TextDocumentSyncKind,
  type Diagnostic,
  type DocumentUri,
  type InitializeParams,
  type Location,
  type LocationLink,
  type WorkspaceDocumentDiagnosticReport,
} from 'vscode-languageserver/node'
import {TextDocuments} from 'vscode-languageserver/node'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {URI} from 'vscode-uri'

import {analyzeWorkspace, getDefinition, getDiagnostics, getFiles, getHover, getReferences, loadWorkspace} from '../../lang/core.ts'
import {type AnalysisResult, type GrapheneError, type Location as GrapheneLocation, type WorkspaceFileInput} from '../../lang/types.ts'
import {discoverGrapheneProjects, findOwningProjectRoot, type DiscoveredGrapheneProject} from './service.ts'

type ProjectRoot = string

interface ProjectState {
  root: ProjectRoot
  files: WorkspaceFileInput[]
  analysis: AnalysisResult
  config: DiscoveredGrapheneProject['config']
}

let connection = createConnection(ProposedFeatures.all)
let documents = new TextDocuments(TextDocument)
let projects = new Map<ProjectRoot, ProjectState>()
let dirtyRoots = new Set<ProjectRoot>()
let reportedDiagnosticUris = new Set<string>()
let ready: Promise<void> = Promise.resolve()
let handle: NodeJS.Timeout | undefined

connection.onInitialize((params: InitializeParams) => {
  ready = loadProjects(params)

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      diagnosticProvider: {interFileDependencies: true, workspaceDiagnostics: true},
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
    },
  }
})

connection.onInitialized(() => {
  void analyzeDirtyProjects()
})

documents.onDidChangeContent(({document}) => {
  let target = projectFromUri(document.uri)
  if (!target) return

  target.project.files = upsertFile(target.project.files, {path: target.path, contents: document.getText()})
  dirtyRoots.add(target.project.root)
  invalidateAnalysis()
})

connection.onDidChangeWatchedFiles(({changes}) => {
  void applyFileChanges(changes)
})

connection.onHover(async ({textDocument, position}) => {
  await ready
  await pendingAnalysis()

  let target = projectFromUri(textDocument.uri)
  if (!target) return null
  return {contents: getHover(target.project.analysis, target.path, position.line, position.character)}
})

connection.onDefinition(async ({textDocument, position}) => {
  await ready
  await pendingAnalysis()

  let target = projectFromUri(textDocument.uri)
  if (!target) return []
  let location = getDefinition(target.project.analysis, target.path, position.line, position.character)
  return location ? [toLocationLink(target.project.root, location)] : []
})

connection.onReferences(async ({textDocument, position, context}) => {
  await ready
  await pendingAnalysis()

  let target = projectFromUri(textDocument.uri)
  if (!target) return []
  return getReferences(target.project.analysis, target.path, position.line, position.character, context.includeDeclaration).map(location => toLocation(target.project.root, location))
})

connection.languages.diagnostics.on(async ({textDocument}) => {
  await ready
  await pendingAnalysis()

  let target = projectFromUri(textDocument.uri)
  return {kind: DocumentDiagnosticReportKind.Full, items: target ? diagnosticsFor(target.project, target.path) : []}
})

connection.languages.diagnostics.onWorkspace(async () => {
  await ready
  await pendingAnalysis()
  return {items: workspaceDiagnostics()}
})

documents.listen(connection)
connection.listen()

async function loadProjects(params: InitializeParams) {
  let discovered = await discoverGrapheneProjects((params.workspaceFolders || []).map(folder => URI.parse(folder.uri)))
  let next = new Map<ProjectRoot, ProjectState>()

  await Promise.all(
    discovered.map(async project => {
      let files = await loadWorkspace(project.root, true, project.config.ignoredFiles)
      next.set(project.root, {root: project.root, config: project.config, files, analysis: {files: [], diagnostics: []}})
    }),
  )

  projects = next
  dirtyRoots = new Set(next.keys())
  connection.console.log(`[graphene] started language server ${JSON.stringify([...projects.values()].map(project => ({root: project.root, files: project.files.length})))}`)
}

async function applyFileChanges(changes: {uri: DocumentUri; type: FileChangeType}[]) {
  await ready

  let touched = false
  connection.console.log(`[graphene] watched files changed ${JSON.stringify(changes.map(change => ({type: fileChangeTypeName(change.type), uri: change.uri})))}`)

  for (let change of changes) {
    let target = projectFromUri(change.uri)
    if (!target) continue

    if (change.type === FileChangeType.Deleted) {
      target.project.files = target.project.files.filter(file => file.path != target.path)
    } else {
      let document = documents.get(change.uri)
      let contents = document?.getText() || (await readWorkspaceFile(target.absolutePath))
      if (contents == null) continue
      target.project.files = upsertFile(target.project.files, {path: target.path, contents})
    }

    dirtyRoots.add(target.project.root)
    touched = true
  }

  if (touched) invalidateAnalysis()
}

function invalidateAnalysis() {
  if (handle) clearTimeout(handle)
  handle = setTimeout(() => void analyzeDirtyProjects(), 200)
}

async function pendingAnalysis() {
  if (!handle) return
  clearTimeout(handle)
  handle = undefined
  await analyzeDirtyProjects()
}

async function analyzeDirtyProjects() {
  await ready
  if (handle) {
    clearTimeout(handle)
    handle = undefined
  }

  let changed = false
  for (let root of dirtyRoots) {
    let project = projects.get(root)
    if (!project) continue

    try {
      project.analysis = analyzeWorkspace({config: project.config, files: project.files})
      project.files = updateParsedFiles(project.files, project.analysis)
      changed = true
    } catch (err) {
      let message = err instanceof Error ? err.stack || err.message : String(err)
      connection.console.error(`Analyze failed for ${root}: ${message}`)
    }
  }

  dirtyRoots.clear()
  if (!changed) return

  await publishDiagnostics()
  connection.languages.diagnostics.refresh()
}

async function publishDiagnostics() {
  let currentUris = new Set<string>()

  for (let project of projects.values()) {
    for (let file of getFiles(project.analysis)) {
      let uri = URI.file(path.resolve(project.root, file.path)).toString()
      currentUris.add(uri)
      await connection.sendDiagnostics({uri, diagnostics: diagnosticsFor(project, file.path)})
    }
  }

  for (let uri of reportedDiagnosticUris) {
    if (!currentUris.has(uri)) await connection.sendDiagnostics({uri, diagnostics: []})
  }

  reportedDiagnosticUris = currentUris
}

function workspaceDiagnostics() {
  let currentUris = new Set<string>()
  let reports: WorkspaceDocumentDiagnosticReport[] = []

  for (let project of projects.values()) {
    for (let file of getFiles(project.analysis)) {
      let uri = URI.file(path.resolve(project.root, file.path)).toString()
      currentUris.add(uri)
      reports.push({kind: DocumentDiagnosticReportKind.Full, uri, version: null, items: diagnosticsFor(project, file.path)})
    }
  }

  for (let uri of reportedDiagnosticUris) {
    if (!currentUris.has(uri)) reports.push({kind: DocumentDiagnosticReportKind.Full, uri, version: null, items: []})
  }

  reportedDiagnosticUris = currentUris
  return reports
}

function diagnosticsFor(project: ProjectState, filePath: string) {
  return getDiagnostics(project.analysis)
    .filter(diagnostic => diagnostic.file === filePath)
    .map(toDiagnostic)
}

function projectFromUri(uri: DocumentUri) {
  let absolutePath = fileUriPath(uri)
  if (!absolutePath) return null

  let root = findOwningProjectRoot(absolutePath, projects.keys())
  if (!root) return null

  let project = projects.get(root)
  if (!project) return null

  return {project, absolutePath, path: path.relative(root, absolutePath)}
}

async function readWorkspaceFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function fileUriPath(uri: DocumentUri): string | null {
  let parsed = URI.parse(uri)
  if (parsed.scheme !== 'file') return null
  return parsed.fsPath
}

function fileChangeTypeName(type: FileChangeType) {
  if (type === FileChangeType.Created) return 'created'
  if (type === FileChangeType.Changed) return 'changed'
  if (type === FileChangeType.Deleted) return 'deleted'
  return String(type)
}

function upsertFile(files: WorkspaceFileInput[], next: WorkspaceFileInput) {
  let idx = files.findIndex(file => file.path == next.path)
  if (idx < 0) return [...files, next]
  return files.map((file, fileIdx) => (fileIdx == idx ? next : file))
}

function updateParsedFiles(files: WorkspaceFileInput[], analysis: AnalysisResult) {
  return files.map(file => {
    let analyzed = analysis.files.find(next => next.path == file.path)
    if (!analyzed) return file
    return {...file, parsed: {tree: analyzed.tree!, virtualContents: analyzed.virtualContents, virtualToMarkdownOffset: analyzed.virtualToMarkdownOffset}}
  })
}

function toDiagnostic(diagnostic: GrapheneError): Diagnostic {
  let from = diagnostic.from || {line: 0, col: 0}
  let to = diagnostic.to || from
  return {
    range: {start: {line: from.line, character: from.col}, end: {line: to.line, character: to.col}},
    severity: diagnostic.severity === 'warn' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
    message: diagnostic.message,
    source: 'graphene',
  }
}

function toLocation(root: ProjectRoot, location: GrapheneLocation): Location {
  return {
    uri: URI.file(path.resolve(root, location.file)).toString(),
    range: {start: {line: location.from.line, character: location.from.col}, end: {line: location.to.line, character: location.to.col}},
  }
}

function toLocationLink(root: ProjectRoot, location: GrapheneLocation): LocationLink {
  let uri = URI.file(path.resolve(root, location.file)).toString()
  let range = {start: {line: location.from.line, character: location.from.col}, end: {line: location.to.line, character: location.to.col}}
  return {targetUri: uri, targetRange: range, targetSelectionRange: range}
}
