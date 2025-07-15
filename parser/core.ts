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
  name: string
  dataType: string
}

interface JoinDef {
  name: string
  tableName: string
  fromTable: TableDef
  expression: SyntaxNode | null
}

interface ComputedDef {
  name: string
  expression: SyntaxNode
}

interface TableDef {
  name: string
  columns: ColumnDef[]
  joins: JoinDef[]
  computed: ComputedDef[]
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
    let table:TableDef = TABLE_MAP[name] = {name, columns: [], joins: [], computed: []}

    table.columns = tn.getChildren("ColumnDef").map(cn => ({
      name: txt(cn.getChild("Identifier")),
      dataType: txt(cn.getChild("DataType")),
    }))

    table.joins = tn.getChildren("JoinDef").map(jn => ({
      name: txt(jn.getChild("Identifier")),
      fromTable: table,
      tableName: txt(jn.getChild("Identifier")),
      expression: jn.getChild("Expression"),
    }))

    table.computed = tn.getChildren("ComputedDef").map(cn => ({
      name: txt(cn.getChild("Identifier")),
      expression: cn.getChild("Expression")!,
    }))
  }

  // we could now walk the tree of measures to optimistically link them together and compute expanded sql or data types
}

function analyzeQuery (queryNode: SyntaxNode) {
  let from = queryNode.getChild("FromClause")
  let tableName = txt(from?.getChild("TableName"))
  let rootTable = TABLE_MAP[tableName]
  let joins = new Set<JoinDef>()
  let isAgg = false

  let selectClause = queryNode.getChild('SelectClause')
  let select = selectClause ? analyzeRefs(selectClause, rootTable) : 'select *'

  let whereClause = queryNode.getChild('WhereClause')
  let where = whereClause && analyzeRefs(whereClause, rootTable)

  let groupByNode = queryNode.getChild('GroupByClause')
  let groupBy = groupByNode && analyzeRefs(groupByNode, rootTable)
  // TODO: ensure groupBys are in the select

  let sql = [
    select,
    `FROM ${rootTable.name}`,
    ...Array.from(joins.values()).map(j => `join ${j.name} ON (${txt(j.expression)})`),
    where,
    isAgg ? 'group by all' : null,
    ';'
  ].filter(x => !!x).join('\n')
  console.log('SQL:', sql)

  function analyzeRefs (expression:SyntaxNode, table: TableDef): string {
    let expanded = txt(expression)
    let offset = expression.from

    getDescendants(expression, 'FunctionCall').forEach(fn => {
      let fnName = txt(fn.getChild('Identifier'))
      isAgg = isAgg || ['min', 'max', 'avg', 'count'].includes(fnName)
    })

    // going back to front is important, otherwise the first replace would break the others
    getDescendants(expression, 'ColumnRef').reverse().map(cn => {
      let parts = cn.getChildren('Identifier').map(n => txt(n))

      // step through each dotted path finding joins
      let currTable = table
      for (let i = 0; i < parts.length - 1; i++) {
        let join = currTable.joins.find(j => j.name == parts[i])!
        currTable = TABLE_MAP[join.tableName]
        joins.add(join)
      }

      let colName = parts[parts.length - 1]
      let comp = currTable.computed.find(c => c.name == colName)
      if (comp) {
        let refExpanded = analyzeRefs(comp.expression, currTable)
        expanded = expanded.slice(0, cn.from - offset) + refExpanded + expanded.slice(cn.to - offset)
      }
    })

    return expanded
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
