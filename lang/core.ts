import type {NodeType, SyntaxNode, Tree} from '@lezer/common'
import {parser} from './parser.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'

const TABLE_MAP: Record<string, TableDef> = {}

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  for (let f of await readdir(dir)) {
    if (!f.endsWith('.gsql')) continue
    let contents = await readFile(path.join(dir, f), 'utf-8')
    let tree = parser.parse(contents)
    tree.rawText = contents
    tree.topNode.getChildren('TableStatement').forEach(analyzeTable)
  }
}

// Entry point for analyzing gsql
export function analyze (source:string): string[] {
  let tree = parser.parse(source)
  tree.rawText = source
  tree.topNode.getChildren('TableStatement').forEach(analyzeTable)
  let queries = tree.topNode.getChildren('QueryStatement').map(analyzeQuery)
  return queries.map(q => q.sql)
}

// Parses a table (model) declaration. Most analysis is done lazily, so this just gets the tables name and fields.
function analyzeTable (tableNode: SyntaxNode) {
  let name = txt(tableNode.firstChild?.nextSibling)
  let table = TABLE_MAP[name] = {name, fields: {}}
  let fields = [
    ...tableNode.getChildren('ColumnDef').map(cn => ({
      type: 'column',
      name: txt(cn.getChild('Identifier')),
      dataType: txt(cn.getChild('DataType')),
    })),
    ...tableNode.getChildren('JoinDef').map(jn => {
      let [tableName, name] = jn.getChildren('Identifier').map(n => txt(n))
      let expression = jn.getChild('Expression')
      return {type: 'join', name: name || tableName, tableName, expression}
    }),
    ...tableNode.getChildren('ComputedDef').map(cn => ({
      type: 'computed',
      name: txt(cn.getChild('Identifier')),
      expression: cn.getChild('Expression')!,
    })),
  ]
  fields.forEach(f => {
    // TODO error on duplicate definitions
    table.fields[f.name] = f
  })
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
function analyzeQuery (queryNode: SyntaxNode): QueryDef {
  let root: TableDef | null
  let joins = new Set<JoinDef>()
  let isAgg = false
  let aliases:Record<string, SyntaxNode> = {}

  // Start with the From clause, since that grounds the rest of the analysis
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  froms.forEach(f => {
    if (f.name == 'TableName' && !root) {
      root = TABLE_MAP[txt(f.getChild('Identifier'))]
      f.sql = root.name
    } else if (f.name == 'Subquery') {
      let sub = analyzeQuery(f.getChild('SubqueryExpression')!.getChild('QueryStatement')!)
      f.sql = `(${sub.sql})`
    } else if (f.name == 'JoinClause') {
      throw new Error('exlicit joins not yet supported')
    }
  })

  // TODO: build up an array of all the columns this query wiil return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    let alias = txt(s.getChild('Identifier'))
    let expr = s.getChild('Expression')!
    if (alias) aliases[alias] = expr
    analyzeExpression(expr)
    s.sql = [expr.sql, alias && `as ${alias}`].filter(x => !!x).join(' ')
  })

  let where = queryNode.getChild('WhereClause')?.getChild('Expression')
  if (where) analyzeExpression(where)

  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('Expression') || []
  groupBys.forEach(g => {
    // TODO if an expression isn't also in `selects`, add it
    analyzeExpression(g)
  })

  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  orderBys.forEach(o => {
    analyzeExpression(o.getChild('Expression')!)
  })

  let joinStrings = Array.from(joins.values()).map(joinDef => {
    let alias = joinDef.name !== joinDef.tableName ? `AS ${joinDef.name}` : ''
    return `LEFT JOIN ${joinDef.tableName} ${alias} ON (${txt(joinDef.expression)})`
  })

  let sql = [
    `SELECT ${selects.map(s => s.sql).join(', ')}`,
    `FROM ${froms.map(f => f.sql).join(' ')}`,
    ...joinStrings,
    where && `WHERE ${where.sql}`,
    isAgg ? 'GROUP BY ALL' : null,
  ].filter(x => !!x).join('\n')
  return {sql, fields: []}

  // Called for each expression in a query, recursively for complex expressions, including computed columns.
  // This reports errors and warnings for symantic issues, as well as generating the final SQL.
  function analyzeExpression (expr:SyntaxNode): SyntaxNode {
    switch (expr.name) {
      case 'Literal':
        expr.sql = txt(expr)
        break
      case 'Wildcard': // * or tableA.tableB.*
        let [wJoin] = lookup(expr)
        expr.sql = wJoin?.name && wJoin.name != root?.name ? `${wJoin.name}.*` : '*'
        break
      case 'ColumnRef':
        let [tbl, colName] = lookup(expr)
        let field = TABLE_MAP[tbl?.tableName || '']?.fields[colName]
        if (field.type == 'computed') {
          expr.sql = analyzeExpression(field.expression).sql
        } else {
          expr.sql = `${tbl?.name}.${colName}`
        }
        break
      case 'FunctionCall':
        let name = txt(expr.getChild('Identifier'))
        let args = expr.getChildren('Expression').map(e => analyzeExpression(e))
        isAgg = ['avg', 'sum', 'min', 'max', 'count'].includes(name)
        expr.sql = `${name}(${args.map(a => a.sql).join(', ')})`
        if (name == 'count' && args.length == 0) expr.sql = 'count(*)' // special case. Don't think * is valid anywhere else as an expression
        break
      case 'Parenthetical':
        let inner = analyzeExpression(expr.getChild('Expression')!)
        expr.sql = `(${inner.sql})`
        break
      case 'BinaryExpression':
        let left = analyzeExpression(expr.firstChild!)
        let right = analyzeExpression(expr.lastChild!)
        let op = txt(left.nextSibling)
        expr.sql = `${left.sql} ${op} ${right.sql}`
        break
      case 'UnaryExpression':
        let unary = analyzeExpression(expr.getChild('Expression')!)
        expr.sql = `${txt(expr.getChild('UnaryOperator'))} ${unary.sql}`
        break
      case 'ExistsExpression':
        let exists = analyzeExpression(expr.getChild('Expression')!)
        expr.sql = `${exists.sql} EXISTS`
        break
      case 'CaseExpression':
        let first = analyzeExpression(expr.getChild('Expression')!)
        let conds = expr.getChildren('WhenClause').map(c => analyzeExpression(c))
        throw new Error('CASE unsupported')
        // expr.sql = `CASE ${first.sql} ${conds.join(' ')} END`
        break
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

  // lookup takes a column ref like `tableA.tableB.someColumn` and follows the dot-joins to get the right column,
  // while also tracking that those tables are now joined to the query.
  function lookup (node:SyntaxNode): [JoinDef | null, string] {
    let parts = node.getChildren('Identifier').map(i => txt(i))

    // this is a subquery. dot-joins are invalid, so we just return the subquery
    if (!root) return [null, parts[0]]

    let curr: JoinDef = {name: root.name, tableName: root.name} as JoinDef
    for (let i = 0; i < parts.length - 1; i++) {
      curr = TABLE_MAP[curr.tableName].fields[parts[i]] as JoinDef
      if (curr.type != 'join') throw new Error("Trying to join on a column that isn't a join.")
      joins.add(curr)
    }

    return [curr, parts[parts.length - 1]]
  }
}

function txt (node:SyntaxNode | null | undefined) {
  if (!node) return ''
  let top: SyntaxNode = node
  while (top.parent) top = top.parent
  return top?.tree?.rawText.substring(node.from, node.to) || ''
}

// function getDescendants (node:SyntaxNode, type:string) {
//   let res = [] as SyntaxNode[]
//   node.cursor().iterate(n => {
//     if (n.name == type) res.push(n.node)
//   })
//   return res
// }

declare module '@lezer/common' {
  interface Tree {
    rawText: string
  }

  interface SyntaxNode {
    sql?: string
  }
}

interface ColumnDef {
  type: 'column'
  name: string
  dataType: string
}

interface JoinDef {
  type: 'join'
  name: string
  tableName: string
  fromTable: TableDef
  expression: SyntaxNode | null
}

interface ComputedDef {
  type: 'computed'
  name: string
  expression: SyntaxNode
}

type FieldDef = ColumnDef | JoinDef | ComputedDef

interface TableDef {
  name: string
  fields: Record<string, FieldDef>
}

interface QueryDef {
  sql: string
  fields: Record<string, any>
}

