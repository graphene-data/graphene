import {parser} from './parser.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'
import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'
import {Table, txt, TABLE_MAP, Query, type Column, type Join, type Computed} from './core.ts'
import {lookup} from './lookup.ts'
import {extractLeadingMetadata} from './metadata.ts'

export type {Query, Table, Diagnostic} from './core.ts'

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  for (let f of await readdir(dir)) {
    if (!f.endsWith('.gsql')) continue
    let contents = await readFile(path.join(dir, f), 'utf-8')
    analyze(contents)
  }
}

export function analyze (source:string): { tables: Table[], queries: Query[] } {
  let tree = parser.parse(source)
  tree.rawText = source
  let tables = [
    ...tree.topNode.getChildren('TableStatement').map(analyzeTable).filter((t): t is Table => !!t),
    ...tree.topNode.getChildren('TableAsQuery').map(analyzeTableAsQuery).filter((t): t is Table => !!t),
  ]
  let queries = tree.topNode.getChildren('QueryStatement').map(analyzeQuery)
  return {tables, queries}
}

// Parses a table (model) declaration. Most analysis is done lazily, so this just gets the tables name and fields.
function analyzeTable (tableNode: SyntaxNode): Table {
  let table = new Table(txt(tableNode.firstChild?.nextSibling))
  TABLE_MAP[table.name] = table
  getParseErrors(tableNode).forEach(n => table.diag(n, 'Syntax error'))
  table.metadata = extractLeadingMetadata(tableNode)

  let fields = [
    ...tableNode.getChildren('ColumnDef').map(cn => ({
      type: 'column',
      name: txt(cn.getChild('Identifier')),
      dataType: txt(cn.getChild('DataType')),
      metadata: extractLeadingMetadata(cn),
    })) satisfies Column[],
    ...tableNode.getChildren('JoinDef').map(jn => {
      let tableName = txt(jn.getChild('Identifier'))
      let alias = txt(jn.getChild('Alias'))
      let expression = jn.getChild('Expression')
      return {type: 'join', alias: alias || tableName, tableName, expression}
    }) satisfies Join[],
    ...tableNode.getChildren('ComputedDef').map(cn => ({
      type: 'computed',
      name: txt(cn.getChild('Identifier')),
      expression: cn.getChild('Expression')!,
      metadata: extractLeadingMetadata(cn),
    })) satisfies Computed[],
  ]
  fields.forEach(f => {
    // TODO error on duplicate definitions
    table.fields[f.type == 'join' ? f.alias : f.name] = f
  })
  return table
}

// Parses a `table <name> as (<query>)` statement into a Table with an attached Query
function analyzeTableAsQuery (node: SyntaxNode): Table {
  let name = txt(node.getChild('Identifier'))
  let table = new Table(name)
  TABLE_MAP[table.name] = table
  getParseErrors(node).forEach(n => table.diag(n, 'Syntax error'))
  table.metadata = extractLeadingMetadata(node)
  let qn = node.getChild('QueryStatement')
  if (qn) {
    table.asQuery = analyzeQuery(qn)
  }
  return table
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
function analyzeQuery (queryNode: SyntaxNode): Query {
  let query = new Query()
  query.treeNode = queryNode
  getParseErrors(queryNode).forEach(n => query.diag(n, 'Syntax error'))

  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  froms.forEach(f => {
    let name = txt(f.getChild('Identifier'))
    let alias = txt(f.getChild('Alias')) || name
    if (f.name == 'TableName') {
      if (!TABLE_MAP[name]) {
        query.diag(f.getChild('Identifier') || f, `Unknown table ${name}`)
      }
      query.tables[alias || name] = {type: 'join', alias, tableName: name}
      f.sql = alias
    } else if (f.name == 'Subquery') {
      let sub = analyzeQuery(f.getChild('SubqueryExpression')!.getChild('QueryStatement')!)
      query.tables[alias || '~'] = {type: 'join', alias, subquery: sub}
      f.sql = `(${sub.sql}${alias ? ' as ' + alias : ''})`
    } else if (f.name == 'JoinClause') {
      throw new Error('exlicit joins not yet supported')
    }
  })

  // TODO: build up an array of all the columns this query wiil return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    let alias = txt(s.getChild('Alias'))
    let expr = s.getChild('Expression')!
    analyzeExpression(expr, query, null)
    s.sql = [expr.sql, alias && `as ${alias}`].filter(x => !!x).join(' ')
  })

  let where = queryNode.getChild('WhereClause')?.getChild('Expression')
  if (where) analyzeExpression(where, query, null)

  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('Expression') || []
  groupBys.forEach(g => {
    // TODO if an expression isn't also in `selects`, add it
    analyzeExpression(g, query, null)
  })

  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  orderBys.forEach(o => {
    analyzeExpression(o.getChild('Expression')!, query, null)
  })

  let fromStrings = Object.values(query.tables).map(joinDef => {
    let tableSql = joinDef.subquery ? `(${joinDef.subquery.sql}` : joinDef.tableName
    if (!tableSql) throw new Error('Joining to an empty tableName')
    let alias = joinDef.alias && joinDef.alias != '~' && joinDef.alias != joinDef.tableName ? ` AS ${joinDef.alias}` : ''

    return joinDef.expression ? `LEFT JOIN ${tableSql}${alias} ON (${txt(joinDef.expression)})` : `FROM ${tableSql}${alias}`
  })

  query.sql = [
    `SELECT ${selects.map(s => s.sql).join(', ')}`,
    fromStrings.join(' '),
    where && `WHERE ${where.sql}`,
    query.isAgg ? 'GROUP BY ALL' : null,
  ].filter(x => !!x).join('\n')
  return query
}

// Called for each expression in a query, recursively for complex expressions, including computed columns.
// This reports errors and warnings for symantic issues, as well as generating the final SQL.
// Scope is used to track the current table we're operating within when analyzing measures. If it's null, the scope is the entire query.
function analyzeExpression (expr:SyntaxNode, query: Query, scope: Join | null): SyntaxNode {
  if (expr.type.isError) {
    expr.sql = txt(expr)
    return expr
  }

  switch (expr.name) {
    case 'Literal':
      expr.sql = txt(expr)
      break
    case 'Wildcard':
      expr.sql = '*'
      break
    case 'ColumnRef':
      let [newScope, field] = lookup(expr, query, scope)
      if (!newScope || !field) return expr
      if (field.type == 'computed') {
        expr.sql = analyzeExpression(field.expression, query, newScope).sql
      } else if (field.type == 'column') {
        expr.sql = `${newScope.alias}.${field.name}`
      }
      break
    case 'FunctionCall':
      let name = txt(expr.getChild('Identifier'))
      let args = expr.getChildren('Expression').map(e => analyzeExpression(e, query, scope))
      query.isAgg ||= ['avg', 'sum', 'min', 'max', 'count'].includes(name)
      expr.sql = `${name}(${args.map(a => a.sql).join(', ')})`
      if (name == 'count' && args.length == 0) expr.sql = 'count(*)' // special case. Don't think * is valid anywhere else as an expression
      break
    case 'Parenthetical':
      let inner = analyzeExpression(expr.getChild('Expression')!, query, scope)
      expr.sql = `(${inner.sql})`
      break
    case 'BinaryExpression':
      let left = analyzeExpression(expr.firstChild!, query, scope)
      let right = analyzeExpression(expr.lastChild!, query, scope)
      let op = txt(left.nextSibling)
      expr.sql = `${left.sql} ${op} ${right.sql}`
      break
    case 'UnaryExpression':
      let unary = analyzeExpression(expr.getChild('Expression')!, query, scope)
      expr.sql = `${txt(expr.getChild('UnaryOperator'))} ${unary.sql}`
      break
    case 'ExistsExpression':
      let exists = analyzeExpression(expr.getChild('Expression')!, query, scope)
      expr.sql = `${exists.sql} EXISTS`
      break
    case 'CaseExpression':
      // let first = analyzeExpression(expr.getChild('Expression')!, scope)
      // let conds = expr.getChildren('WhenClause').map(c => analyzeExpression(c, scope))
      throw new Error('CASE unsupported')
    case 'SubqueryExpression':
      let subSql = analyzeQuery(expr.getChild('QueryStatement')!)
      expr.sql = `(${subSql})`
      break
    case 'InExpression':
    default:
      throw new Error(`Unsupported expression: ${txt(expr)}`)
  }

  return expr
}

function getParseErrors (node: SyntaxNode): SyntaxNode[] {
  let errorNodes: SyntaxNode[] = []

  node.cursor().iterate((n: SyntaxNodeRef) => {
    if (n.type.isError) {
      errorNodes.push(n.node)
    }
  })
  return errorNodes
}
