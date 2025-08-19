import {parser} from './parser.js'
import {analyze, getTable} from './analyze.ts'
import {txt, type Table} from './core.ts'

export type CompletionKind = 'table' | 'column' | 'join'

export interface CompletionItem {
  label: string
  kind: CompletionKind
}

function computeOffset (text: string, line: number, character: number): number {
  let idx = 0
  let currLine = 0
  while (currLine < line && idx < text.length) {
    let nl = text.indexOf('\n', idx)
    if (nl === -1) return text.length
    idx = nl + 1
    currLine++
  }
  return Math.min(idx + character, text.length)
}

// Extract the base table name from the text prior to the cursor.
function findBaseTableName (prefix: string): string | undefined {
  // Match last FROM <table> optionally followed by alias
  // Keep it simple for first pass; subqueries not handled here
  let re = /(\bfrom\s+)([a-zA-Z_][\w]*)/gi
  let m: RegExpExecArray | null
  let last: string | undefined
  while ((m = re.exec(prefix))) last = m[2]
  return last
}

function isFromContext (prefix: string): {partial?: string} | null {
  // Detect if cursor is in FROM clause position: "... from <partial>"
  let m = /(\bfrom\s+)([a-zA-Z_][\w]*)?$/i.exec(prefix)
  if (!m) return null
  return {partial: m[2]}
}

function lastKeyword (prefix: string): 'select' | 'group by' | 'order by' | undefined {
  let p = prefix.toLowerCase()
  let idxSelect = p.lastIndexOf('select')
  let idxGroup = p.lastIndexOf('group by')
  let idxOrder = p.lastIndexOf('order by')
  let idx = Math.max(idxSelect, idxGroup, idxOrder)
  if (idx === -1) return undefined
  if (idx === idxGroup) return 'group by'
  if (idx === idxOrder) return 'order by'
  return 'select'
}

// Resolve a dotted path (without the trailing segment) to a Table starting from base table
function resolveEntityTable (baseTableName: string | undefined, parentPath: string[]): Table | undefined {
  if (!baseTableName) return undefined
  let base = getTable(baseTableName)
  if (!base) return undefined
  let curr = base
  for (let part of parentPath) {
    // Find a JoinDef in curr with alias == part or target == part
    let join = curr.syntaxNode.getChildren('JoinDef').find(jn => {
      let alias = txt(jn.getChild('Alias'))
      let target = txt(jn.getChild('Identifier'))
      return alias === part || target === part
    })
    if (!join) return undefined
    let targetName = txt(join.getChild('Identifier'))
    curr = getTable(targetName) || curr
  }
  return curr
}

function getTableMembers (table: Table): {columns: string[]; joins: string[]} {
  // Collect column-like members from ColumnDef and ComputedDef
  let columns = [
    ...table.syntaxNode.getChildren('ColumnDef').map(cn => txt(cn.getChild('Identifier'))),
    ...table.syntaxNode.getChildren('ComputedDef').map(cn => txt(cn.getChild('Identifier'))),
  ].filter(Boolean)
  let joins = table.syntaxNode.getChildren('JoinDef').map(jn => txt(jn.getChild('Alias')) || txt(jn.getChild('Identifier'))).filter(Boolean)
  return {columns, joins}
}

function parsePathAtCursor (prefix: string): {parentPath: string[]; partial?: string; hasDot: boolean} | null {
  // Capture something like: users.name, users., users.na, users.friends.
  let m = /([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)(\.)?([A-Za-z_][\w]*)?$/.exec(prefix)
  if (!m) return null
  let path = m[1]
  if (!path) return null
  let hasDot = !!m[2]
  let parts = path.split('.')
  // If there is a trailing dot, parent is full parts; otherwise parent is all but last
  let parentPath = hasDot ? parts : parts.slice(0, -1)
  let partial = hasDot ? undefined : parts[parts.length - 1]
  return {parentPath, partial, hasDot}
}

export function getCompletions (text: string, line: number, character: number): CompletionItem[] {
  // Ensure tables are registered for this text
  try { analyze(text) } catch {}

  let offset = computeOffset(text, line, character)
  let prefix = text.slice(0, offset)

  // FROM context → suggest tables
  let fromCtx = isFromContext(prefix)
  if (fromCtx) {
    let partialLower = (fromCtx.partial || '').toLowerCase()
    // Suggest all registered tables by scanning declarations in current text (aligns with analyze())
    let declared = Array.from(text.matchAll(/\btable\s+([A-Za-z_][\w]*)/gi)).map(m => m[1])
    let unique = Array.from(new Set(declared))
    return unique
      .filter(n => n.toLowerCase().startsWith(partialLower))
      .map(n => ({label: n, kind: 'table' as const}))
  }

  // Expression context (SELECT/GROUP BY/ORDER BY) → suggest columns (and joins after dot)
  let last = lastKeyword(prefix)
  if (!last) return []

  let baseTable = findBaseTableName(prefix)
  if (!baseTable) return []

  let pathInfo = parsePathAtCursor(prefix)
  if (pathInfo) {
    let {parentPath, partial, hasDot} = pathInfo
    let entity = resolveEntityTable(baseTable, parentPath)
    if (!entity) return []
    let {columns, joins} = getTableMembers(entity)
    let all: CompletionItem[] = []
    if (hasDot) {
      all = [
        ...columns.map(c => ({label: c, kind: 'column' as const})),
        ...joins.map(j => ({label: j, kind: 'join' as const})),
      ]
    } else {
      // No dot: only suggest columns from the base table
      all = columns.map(c => ({label: c, kind: 'column' as const}))
    }
    if (partial) {
      let pl = partial.toLowerCase()
      all = all.filter(i => i.label.toLowerCase().startsWith(pl))
    }
    let seen = new Set<string>()
    return all.filter(i => (seen.has(i.label) ? false : (seen.add(i.label), true)))
  }

  // Default: suggest base table columns
  let base = getTable(baseTable)
  if (!base) return []
  let {columns} = getTableMembers(base)
  return columns.map(c => ({label: c, kind: 'column' as const}))
}