import type {NodeType, SyntaxNode, Tree} from "@lezer/common"
import { parser } from './parser.js'

const TABLE_MAP: Record<string, TableDef> = {}
let currentSource = ""

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

export function analyze (source:string): string[] {
  currentSource = source
  let tree = parser.parse(source)

  analyzeTables(tree.topNode.getChildren('TableStatement'))
  let queries = tree.topNode.getChildren('QueryStatement').map(analyzeQuery)
  return queries
}

function analyzeTables (tableNodes: SyntaxNode[]) {
  for (let tn of tableNodes) {
    let name = txt(tn.firstChild?.nextSibling)
    let table = TABLE_MAP[name] = {name, fields: {}}
    let fields = [
      ...tn.getChildren("ColumnDef").map(cn => ({
        type: 'column',
        name: txt(cn.getChild("Identifier")),
        dataType: txt(cn.getChild("DataType")),
      })),
      ...tn.getChildren("JoinDef").map(jn => {
        let [tableName, name] = jn.getChildren("Identifier").map(n => txt(n))
        let expression = jn.getChild("Expression")
        return { type: 'join', name: name || tableName, tableName, expression }
      }),
      ...tn.getChildren("ComputedDef").map(cn => ({
        type: 'computed',
        name: txt(cn.getChild("Identifier")),
        expression: cn.getChild("Expression")!,
      })),
    ]
    fields.forEach(f => {
      // TODO error on duplicate definitions
      table.fields[f.name] = f
    })
  }
}

function analyzeQuery (queryNode: SyntaxNode): string {
  let scope: JoinDef
  let rootTable: SyntaxNode
  let joins = new Set<JoinDef>()
  let isAgg = false
  let aliases:Record<string, SyntaxNode> = {}

  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  let rootFrom = froms[0] // TODO: handle explicit joins

  if (rootFrom.name == 'TableName') {
    let tableName = txt(rootFrom?.getChild('Identifier'))
    scope = {name: tableName, tableName} as JoinDef
    rootFrom.sql = `FROM ${tableName}`
  } else if (rootFrom.name == 'Subquery') {
    let sqn = rootFrom.getChild('SubqueryExpression')?.getChild('QueryStatement')!
    scope = {name: '', tableName: ''} as JoinDef
    rootFrom.sql = `FROM (${analyzeQuery(sqn)})`
  }

  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    let wc = s.getChild('Wildcard')
    if (wc) {
      analyzeExpression(wc, scope)
      s.sql = wc.sql
    } else {
      let alias = txt(s.getChild('Identifier'))
      let expr = s.getChild('Expression')!
      if (alias) aliases[alias] = expr
      analyzeExpression(expr, scope)
      s.sql = [expr.sql, alias && `as ${alias}`].filter(x => !!x).join(' ')
    }
  })

  let where = queryNode.getChild('WhereClause')?.getChild('Expression')
  if (where) analyzeExpression(where, scope)

  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('Expression') || []
  groupBys.forEach(g => {
    // TODO if an expression isn't also in `selects`, add it
    analyzeExpression(g, scope)
  })

  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  orderBys.forEach(o => {
    analyzeExpression(o.getChild('Expression')!, scope)
  })

  let joinStrings = Array.from(joins.values()).map(joinDef => {
    let alias = joinDef.name !== joinDef.tableName ? `AS ${joinDef.name}` : ''
    return `LEFT JOIN ${joinDef.tableName} ${alias} ON (${txt(joinDef.expression)})`
  })

  let sql = [
    `SELECT ${selects.map(s => s.sql).join(', ')}`,
    rootFrom.sql,
    ...joinStrings,
    where && `WHERE ${where.sql}`,
    isAgg ? 'group by all' : null,
  ].filter(x => !!x).join('\n')
  return sql

  // Called for each expression in a query, recursively for complex expressions, including computed columns.
  // This reports errors and warnings for symantic issues, as well as generating the final SQL.
  function analyzeExpression (expr:SyntaxNode, scope: JoinDef): SyntaxNode {
    switch (expr.name) {
      case 'Literal':
        expr.sql = txt(expr)
        break
      case 'Wildcard': // * or tableA.tableB.*
        let [wJoin] = lookup(expr, scope)
        expr.sql = wJoin.name ? `${wJoin.name}.*` : '*'
        break
      case 'ColumnRef':
        let [currJoin, colName] = lookup(expr, scope)
        let field = TABLE_MAP[currJoin.tableName].fields[colName]
        if (field.type == 'computed') {
          expr.sql = analyzeExpression(field.expression, currJoin).sql
        } else {
          expr.sql = `${currJoin.name}.${colName}`
        }
        break
      case 'FunctionCall':
        let name = txt(expr.getChild("Identifier"))
        let args = expr.getChildren("Expression").map(e => analyzeExpression(e, scope))
        isAgg = ['avg', 'sum', 'min', 'max', 'count'].includes(name)
        expr.sql = `${name}(${args.map(a => a.sql).join(', ')})`
        break
      case 'Parenthetical':
        expr.sql = analyzeExpression(expr.getChild("Expression")!, scope)
        break
      case 'BinaryExpression':
        let left = analyzeExpression(expr.firstChild!, scope)
        let right = analyzeExpression(expr.lastChild!, scope)
        let op = txt(left.nextSibling)
        expr.sql = `${left.sql} ${op} ${right.sql}`
        break
      case 'UnaryExpression':
        let unary = analyzeExpression(expr.getChild("Expression")!, scope)
        expr.sql = `${txt(expr.getChild("UnaryOperator"))} ${inner.sql}`
        break
      case 'ExistsExpression':
        let exists = analyzeExpression(expr.getChild("Expression")!, scope)
        expr.sql = `${exists.sql} EXISTS`
        break
      case 'CaseExpression':
        let first = analyzeExpression(expr.getChild("Expression")!, scope)
        let conds = expr.getChildren("WhenClause").map(c => analyzeExpression(c, scope))
        // expr.sql = `CASE ${first.sql} ${conds.join(' ')} END`
        // break
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

  function lookup(node:SyntaxNode, currJoin: JoinDef): [JoinDef, string] {
    let parts = node.getChildren("Identifier").map(i => txt(i))
    for (let i = 0; i < parts.length - 1; i++) {
      currJoin = TABLE_MAP[currJoin.tableName].fields[parts[i]] as JoinDef
      if (currJoin.type != 'join') throw new Error("Trying to join on a column that isn't a join.")
      joins.add(currJoin)
    }

    return [currJoin, parts[parts.length - 1]]
  }
}



function txt(node:SyntaxNode | null | undefined) {
  if (!node) return ""
  return currentSource.substring(node.from, node.to)
}

function getDescendants (node:SyntaxNode, type:string) {
  let res = [] as SyntaxNode[]
  node.cursor().iterate(n => {
    if (n.name == type) res.push(n.node)
  })
  return res
}
