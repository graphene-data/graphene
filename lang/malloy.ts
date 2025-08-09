/*
  Malloy IR translation layer for Graphene queries.
  - renderSql(query): returns SQL string using Malloy compiler
  - toMalloy(query): returns [QueryModel, Query] malloy constructs

  Notes:
  - We currently assume all scalar fields are type 'number' unless clearly string-like by heuristic.
  - Many features are stubbed; we throw for unsupported constructs for now.
*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {Query as GrapheneQuery, Table as GrapheneTable, Column as GrapheneColumn, Join as GrapheneJoin} from './core.ts'
import {TABLE_MAP, txt} from './core.ts'

// Prefer the real Malloy QueryModel from the installed package
// Ensure dialects are registered for compilation
// These are deep imports which exist in the published package
import {QueryModel as RealQueryModel} from '@malloydata/malloy/dist/model/malloy_query.js'
import '@malloydata/malloy/dist/dialect/dialect_map.js'

// Minimal Malloy IR type declarations (kept for construction typing)
namespace malloy {
  export type AtomicType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp'

  export interface AtomicFieldDef {
    type: AtomicType
    name: string
    e?: Expression
  }

  export interface RefToField {
    type: 'fieldref'
    path: string[]
  }

  export interface JoinFieldDef extends TableSourceDef {
    join: 'one' | 'many'
    onExpression?: Expression
  }

  export type FieldDef = AtomicFieldDef | JoinFieldDef | RefToField

  export interface TableSourceDef {
    type: 'table'
    name: string
    fields?: FieldDef[]
    connection?: string
    dialect?: string
    tablePath?: string
  }

  export interface QuerySourceDef {
    type: 'query_source'
    name: string
    fields: AtomicFieldDef[]
    connection?: string
    dialect?: string
    query: Query
  }

  export type StructContent = TableSourceDef | QuerySourceDef

  export interface ModelDef {
    name: string
    exports: string[]
    contents: Record<string, StructContent>
    queryList: Query[]
    dependencies: Record<string, unknown>
  }

  export type FilterExpression = {
    node: 'filterCondition'
    code: string
    expressionType: 'scalar'
    e: Expression
  }

  export type Expression =
    | {node: 'field'; path: string[]}
    | {node: 'numberLiteral'; literal: string}
    | {node: 'stringLiteral'; literal: string}
    | {node: 'aggregate'; function: 'sum' | 'avg' | 'min' | 'max' | 'count'; e?: Expression}
    | {node: '/'; kids: {left: Expression; right: Expression}}
    | {node: '+' | '-' | '*' | '%'; kids: {left: Expression; right: Expression}}
    | {node: '=' | '!=' | '<>' | '<' | '>' | '<=' | '>='; kids: {left: Expression; right: Expression}}
    | {node: 'like'; kids: {left: Expression; right: Expression}}
    | {node: 'and' | 'or'; kids: {left: Expression; right: Expression}}
    | {node: 'not'; e: Expression}
    | {node: 'all'; e: Expression}

  export interface ProjectStage {
    type: 'project'
    queryFields: (RefToField | AtomicFieldDef)[]
  }

  export interface ReduceStage {
    type: 'reduce'
    queryFields: (RefToField | AtomicFieldDef)[]
    filterList?: FilterExpression[]
  }

  export type PipelineStage = ProjectStage | ReduceStage

  export interface Query {
    structRef: string
    pipeline: PipelineStage[]
  }
}

export type MalloyQueryModel = any
export type MalloyQuery = any

// Public API: rendering using Malloy compiler
export function renderSql (query: GrapheneQuery): string {
  const [qm, mq] = toMalloy(query)
  const compiled = (qm as any).compileQuery(mq)
  return compiled.sql
}

// Translate Graphene Query + TABLE_MAP into Malloy IR
export function toMalloy (query: GrapheneQuery): [MalloyQueryModel, MalloyQuery] {
  const contents: Record<string, malloy.StructContent> = {}
  for (const [name, t] of Object.entries(TABLE_MAP)) {
    if (t.asQuery) {
      const q = translateQuery(t.asQuery, name)
      const fields = inferFieldsFromQuery(t.asQuery)
      contents[name] = {
        type: 'query_source',
        name,
        fields,
        connection: 'duckdb',
        dialect: 'duckdb',
        query: q,
      }
    } else {
      contents[name] = translateTable(t)
    }
  }

  const model: malloy.ModelDef = {
    name: 'generated_model',
    exports: [],
    contents,
    queryList: [],
    dependencies: {},
  }

  const qm = new RealQueryModel(model)
  const mq = translateQuery(query)
  return [qm as MalloyQueryModel, mq as MalloyQuery]
}

function translateTable (t: GrapheneTable): malloy.TableSourceDef {
  const fields: malloy.FieldDef[] = []
  for (const f of Object.values(t.fields)) {
    if ((f as GrapheneColumn).type === 'column') {
      const col = f as GrapheneColumn
      fields.push({type: guessType(col.dataType), name: col.name})
    } else if ((f as GrapheneJoin).type === 'join') {
      const j = f as GrapheneJoin
      const target = TABLE_MAP[j.tableName || '']
      if (!target) throw new Error(`Unknown join target table: ${j.tableName}`)
      const joined = translateTable(target) as malloy.JoinFieldDef
      joined.name = j.alias
      joined.join = 'one'
      if (j.expression) {
        joined.onExpression = translateExpressionSql(txt(j.expression))
      }
      fields.push(joined)
    } else {
      continue
    }
  }
  return {
    type: 'table',
    name: t.name,
    fields,
    connection: 'duckdb',
    dialect: 'duckdb',
    tablePath: t.name,
  }
}

function translateQuery (q: GrapheneQuery, structNameHint?: string): malloy.Query {
  const structRef = pickPrimaryStruct(q, structNameHint)
  const selectExprs = collectSelects(q)
  const filter = collectFilter(q)

  const queryFields = selectExprs
  const reduce: malloy.ReduceStage = {
    type: 'reduce',
    queryFields,
    filterList: filter ? [filter] : undefined,
  }

  return {structRef, pipeline: [reduce]}
}

function pickPrimaryStruct (q: GrapheneQuery, hint?: string): string {
  if (hint) return hint
  const first = Object.values(q.tables)[0]
  if (!first) throw new Error('Query has no tables in FROM')
  return first.alias || first.tableName || 'unknown'
}

function collectSelects (q: GrapheneQuery): (malloy.RefToField | malloy.AtomicFieldDef)[] {
  const node = q.treeNode
  if (!node) throw new Error('Query.treeNode missing; ensure analyze() sets treeNode on Query')

  const select = node.getChild('SelectClause')
  if (!select) return []

  const items = select.getChildren('SelectItem')
  const out: (malloy.RefToField | malloy.AtomicFieldDef)[] = []
  for (const it of items) {
    const alias = it.getChild('Alias')?.toString() ? it.getChild('Alias') : null
    const expr = it.getChild('Expression')
    if (!expr) continue

    if (expr.name === 'ColumnRef') {
      const path = expr.getChildren('Identifier').map(id => txt(id))
      out.push({type: 'fieldref', path})
    } else {
      const name = alias ? txt(alias) : deriveExprAlias(expr)
      out.push({type: 'number', name, e: translateExpr(expr, q)})
    }
  }
  return out
}

function collectFilter (q: GrapheneQuery): malloy.FilterExpression | null {
  const node = q.treeNode
  if (!node) return null
  const wc = node.getChild('WhereClause')
  if (!wc) return null
  const expr = wc.getChild('Expression')
  if (!expr) return null
  return {
    node: 'filterCondition',
    code: txt(expr) || 'filter',
    expressionType: 'scalar',
    e: translateExpr(expr, q),
  }
}

function deriveExprAlias (_expr: any): string {
  return 'expr'
}

function translateExpr (expr: any, q: GrapheneQuery): malloy.Expression {
  switch (expr.name) {
    case 'Literal': {
      const raw = txt(expr)
      if (raw == null) throw new Error('Empty literal')
      if (/^\d+(\.\d+)?$/.test(raw)) return {node: 'numberLiteral', literal: raw}
      if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
        return {node: 'stringLiteral', literal: raw.slice(1, -1)}
      }
      return {node: 'stringLiteral', literal: raw}
    }
    case 'ColumnRef':
      return {node: 'field', path: expr.getChildren('Identifier').map((i: any) => txt(i))}
    case 'FunctionCall': {
      const fn = txt(expr.getChild('Identifier')).toLowerCase()
      const args = expr.getChildren('Expression')
      if (['sum', 'avg', 'min', 'max', 'count'].includes(fn)) {
        return {node: 'aggregate', function: fn as any, e: args[0] ? translateExpr(args[0], q) : undefined}
      }
      throw new Error(`Unsupported function '${fn}' in Malloy translation`)
    }
    case 'Parenthetical':
      return translateExpr(expr.getChild('Expression'), q)
    case 'BinaryExpression': {
      const left = translateExpr(expr.firstChild, q)
      const right = translateExpr(expr.lastChild, q)
      const op = txt(expr.firstChild.nextSibling).toLowerCase()
      const allowed = ['+', '-', '*', '/', '%', '=', '!=', '<>', '<', '>', '<=', '>=', 'like', 'and', 'or']
      if (!allowed.includes(op)) throw new Error(`Unsupported operator '${op}' in Malloy translation`)
      if (op === 'and' || op === 'or') return {node: op as any, kids: {left, right}}
      if (op === 'like') return {node: 'like', kids: {left, right}}
      if (op === '/' || op === '+' || op === '-' || op === '*' || op === '%') return {node: op as any, kids: {left, right}}
      return {node: op as any, kids: {left, right}}
    }
    case 'UnaryExpression': {
      const inner = translateExpr(expr.getChild('Expression'), q)
      const u = txt(expr.getChild('UnaryOperator')).toLowerCase()
      if (u === 'not') return {node: 'not', e: inner}
      if (u === '+' || u === '-') {
        const zero: malloy.Expression = {node: 'numberLiteral', literal: '0'}
        return {node: u === '+' ? '+' : '-', kids: {left: zero, right: inner}}
      }
      throw new Error(`Unsupported unary operator '${u}'`)
    }
    case 'SubqueryExpression':
      throw new Error('Subquery expression translation is not yet implemented in Malloy IR')
    default:
      throw new Error(`Unsupported expression node '${expr.name}' in Malloy translation`)
  }
}

function translateExpressionSql (sql: string): malloy.Expression {
  const m = sql.match(/\s*([\w\.]+)\s*(=)\s*([\w\.]+)\s*/i)
  if (!m) throw new Error(`Unsupported join expression: ${sql}`)
  const left = {node: 'field', path: m[1].split('.')}
  const right = {node: 'field', path: m[3].split('.')}
  return {node: '=', kids: {left, right}}
}

function inferFieldsFromQuery (_q: GrapheneQuery): malloy.AtomicFieldDef[] {
  const node = _q.treeNode
  if (!node) return []
  const select = node.getChild('SelectClause')
  if (!select) return []
  const items = select.getChildren('SelectItem')
  const fields: malloy.AtomicFieldDef[] = []
  for (const it of items) {
    const expr = it.getChild('Expression')
    if (!expr) continue
    const name = it.getChild('Alias') ? txt(it.getChild('Alias')) : deriveExprAlias(expr)
    fields.push({type: 'number', name})
  }
  return fields
}

function guessType (sqlType: string): malloy.AtomicType {
  const t = (sqlType || '').toLowerCase()
  if (!t) return 'number'
  if (t.includes('char') || t.includes('text') || t.includes('string')) return 'string'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('date') && !t.includes('time')) return 'date'
  if (t.includes('time')) return 'timestamp'
  return 'number'
}