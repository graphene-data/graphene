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

interface Field {
  type: "column" | "join" | "computed"
  name: string
  dataType?: string
  tableName?: string
  expression?: string
  expandedExpression?: string
  joins?: Field[]
}

interface TableDef {
  name: string
  fields: Field[]
}

export function analyze (source:string) {
  currentSource = source
  let r = {source, queries: [], tables: []}
  let tree = parser.parse(source)

  let tableNodes = tree.topNode.getChildren('TableStatement')
  analyzeTables(tableNodes)
  console.dir(TABLE_MAP, {depth: null})
  console.log('---------------------------------------------------')

  tree.topNode.getChildren('QueryStatement').forEach(analyzeQuery)
}

function analyzeTables (tableNodes: SyntaxNode[]) {
  // first find all the tables defined, and their regular columns
  for (let tn of tableNodes) {
    let name = txt(tn.firstChild?.nextSibling)
    let columns = tn.getChildren("ColumnDef").map(cn => {
      return {
        type: 'column',
        name: txt(cn.getChild("Identifier")),
        dataType: txt(cn.getChild("DataType")),
      }
    })
    TABLE_MAP[name] = { name, fields: columns }
  }


  for (let tn of tableNodes) {
    let name = txt(tn.firstChild?.nextSibling)
    let tableDef = TABLE_MAP[name]

    // next, look for joins between tables
    for (let jn of tn.getChildren("JoinDef")) {
      let destName = txt(jn.getChild("Identifier"))
      tableDef.fields.push({
        type: 'join',
        name: destName,
        tableName: destName,
        expression: txt(jn.getChild("Expression")),
      })
    }

    for (let mn of tn.getChildren("ComputedDef")) {
      let mname = txt(mn.getChild("Identifier"))
      let expression = mn.getChild("Expression")!
      let joins = [] as Field[]
      let expanded = expandComputedRefs(expression, tableDef, joins)
      tableDef.fields.push({
        type: 'computed',
        name: mname,
        expression: txt(expression),
        expandedExpression: expanded,
        joins,
      })
    }
  }
}

function analyzeQuery (queryNode: SyntaxNode) {
  let from = queryNode.getChild("FromClause")
  let tableName = txt(from?.getChild("TableName"))
  let table = TABLE_MAP[tableName]
  let joins = [] as Field[]

  // selects and groups get the same join/measure expansion
  // ensure groupBys are in the select
  // ensure if there are agg functions,
  let select = expandComputedRefs(queryNode.getChild('SelectClause')!, table, joins)

  let joinMap = new Set()
  joins = joins.filter(j => {
    let inc = !joinMap.has(j.name)
    joinMap.add(j.name)
    return inc
  })

  let sql = [
    select,
    `FROM ${table.name}`,
    ...joins.map(j => `join ${j.name} ON (${j.expression})`)
  ].join(' ')
  console.log('SQL:', sql)

//   console.log('Malloy:', `run ${tableName} -> {
//     select: ${txt(queryNode.getChild('SelectClause'))}
// }`)
}

function toSql (node:SyntaxNode, source:string):string {
  let content = source.substring(node.from, node.to)

  switch (node.name) {
    case "QueryStatement":
      let parts = [
        node.getChild("SelectClause"),
        node.getChild("FromClause"),
        node.getChild("WhereClause"),
      ].filter(n => !! n)
      return parts.map(n => toSql(n, source)).join('\n')
    case "SelectClause":
      return "SELECT " + node.getChildren("SelectItem").map(c => toSql(c, source)).join(', ')
    case "FromClause":
    case "WhereClause":
      return content
    default:
      return content
  }
}

function expandComputedRefs (expression:SyntaxNode, rootTable: TableDef, joins: Field[]): string {
  let expanded = txt(expression)
  let offset = expression.from

  // going back to front is important, otherwise the first replace would break the others
  getDescendants(expression, 'ColumnRef').reverse().map(cn => {
    let parts = txt(cn).split('.')
    const [paths, col] = [parts.slice(0,-1), ...parts.slice(-1)]

    // follow paths to add joins
    paths.forEach(p => joins.push(rootTable.fields.find(f => f.name == p)!))

    let field = rootTable.fields.find(f => f.name == col)
    if (field?.type == 'computed') {
      field.joins?.forEach(j => joins.push(j))
      expanded = expanded.slice(0, cn.from - offset) + field.expandedExpression + expanded.slice(cn.to - offset)
    }
  })

  return expanded
}

function txt(node:SyntaxNode | null | undefined) {
  if (!node) return ""
  return currentSource.substring(node.from, node.to)
}




function getDescendants (node:SyntaxNode, type:string) {
  let res = [] as SyntaxNode[]
  let curr = node.cursor()
  do {
    if (curr.name == type) res.push(curr.node)
  } while (curr.next())
  return res
}

function getChildren (node:SyntaxNode) {
  let children = [] as SyntaxNode[]
  let curr = node.firstChild
  while (curr) {
    children.push(curr)
    curr = curr.nextSibling
  }
  return children
}
