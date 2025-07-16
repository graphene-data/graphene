import type {NodeType, SyntaxNode} from "@lezer/common"
import { parser } from './parser.js'

const TABLE_MAP: Record<string, TableDef> = {}
let currentSource = ""

analyze(`
  table flights (
    flight_num varchar,
    tail_num varchar,
    carrier varchar,
    purchased_seats int,

    join_one aircraft on aircraft.tail_num = tail_num,
    measure percent_filled (purchased_seats / aircraft.seats * 100.0),
  );

  table aircraft (
    tail_num varchar,
    seats int,
  );

  from flights select carrier, avg(percent_filled), avg(aircraft.seats);
`)

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

export function analyze (source:string) {
  currentSource = source
  let tree = parser.parse(source)

  analyzeTables(tree.topNode.getChildren('TableStatement'))
  tree.topNode.getChildren('QueryStatement').forEach(analyzeQuery)
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
      ...tn.getChildren("JoinDef").map(jn => ({
        type: 'join',
        name: txt(jn.getChild("Identifier")),
        fromTable: table,
        tableName: txt(jn.getChild("Identifier")),
        expression: jn.getChild("Expression"),
      })),
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

  // we could now walk the tree of measures to optimistically link them together and compute expanded sql or data types
}

function analyzeQuery (queryNode: SyntaxNode) {
  let from = queryNode.getChild("FromClause")
  let tableName = txt(from?.getChild("TableName"))
  let rootTable = TABLE_MAP[tableName]
  let joins = new Set<JoinDef>()
  let isAgg = false
  let aliases:Record<string, SyntaxNode> = {}

  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    let alias = txt(s.getChild('Identifier'))
    let expr = s.getChild('Expression')!
    if (alias) aliases[alias] = expr
    analyzeExpression(expr, rootTable)
    s.sql = [expr.sql, alias && `as ${alias}`].filter(x => !!x).join(' ')
  })

  // TODO if expressions past this point refer to a Computed

  let where = queryNode.getChild('WhereClause')?.getChild('Expression')
  if (where) analyzeExpression(where, rootTable)

  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('Expression') || []
  groupBys.forEach(g => {
    // TODO if an expression isn't also in `selects`, add it
    analyzeExpression(g, rootTable)
  })

  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  orderBys.forEach(o => {
    analyzeExpression(o.getChild('Expression')!, rootTable)
  })

  let sql = [
    `SELECT ${selects.map(s => s.sql).join(', ')}`,
    `FROM ${rootTable.name}`,
    ...Array.from(joins.values()).map(j => `JOIN ${j.name} ON (${txt(j.expression)})`),
    where && `WHERE ${where.sql}`,
    isAgg ? 'group by all' : null,
    ';'
  ].filter(x => !!x).join('\n')
  console.log('SQL:', sql)

  function analyzeExpression (expr:SyntaxNode, table: TableDef): SyntaxNode {
    switch (expr.name) {
      case 'Literal':
        expr.sql = txt(expr)
        break
      case 'ColumnRef':
        let parts = expr.getChildren("Identifier").map(i => txt(i))
        let currTable = table // step through each dotted path finding joins
        for (let i = 0; i < parts.length - 1; i++) {
          let field = currTable.fields[parts[i]]
          if (field.type != 'join') throw new Error("Tried to join through a column")
          currTable = TABLE_MAP[field.tableName]
          joins.add(field)
        }

        let field = currTable.fields[parts[parts.length - 1]]
        if (field.type == 'computed') {
          expr.sql = analyzeExpression(field.expression, currTable).sql
        } else {
          expr.sql = txt(expr)
        }
        break
      case 'FunctionCall':
        let name = txt(expr.getChild("Identifier"))
        let args = expr.getChildren("Expression").map(e => analyzeExpression(e, table))
        isAgg = ['avg', 'sum', 'min', 'max', 'count'].includes(name)
        expr.sql = `${name}(${args.map(a => a.sql).join(', ')})`
        break
      case 'Parenthetical':
        expr.sql = analyzeExpression(expr.getChild("Expression")!, table)
        break
      case 'BinaryExpression':
        let left = analyzeExpression(expr.firstChild!, table)
        let right = analyzeExpression(expr.lastChild!, table)
        let op = txt(left.nextSibling)
        expr.sql = `${left.sql} ${op} ${right.sql}`
        break
      case 'UnaryExpression':
      case 'CaseExpression':
      case 'ExistsExpression':
      case 'InExpression':
      case 'SubqueryExpression':
      default:
        throw new Error(`Unsupported expression: ${txt(expr)}`)
    }

    return expr
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
