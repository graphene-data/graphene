import {Query, TABLE_MAP, txt} from './core.ts'
import type {Join, Computed, Column} from './core.ts'
import type {SyntaxNode} from '@lezer/common'

type Field = Column | Join | Computed

type LookupResult = [Join | null, Field | null]

function pushError(query: Query, node: SyntaxNode, message: string) {
  query.diagnostics.push({ from: node.from, to: node.to, message, severity: 'error' })
}

// Takes a column ref like `someCol` or `tableA.tableB.otherCol` and finds it.
// This returns a JoinDef, telling us which table within the query we're pointing to, and the FieldDef.
// The table name is within the context of the current query, so it might be an alias.
// As it traverses joins it automatically adds them to the query. NB that query and scope can be different if we're following dim/measures into a model
//
// Eventually, we also want this to handle model definition scope, where the tables it searchs are constrained
// by the relative paths where those tables are defined (ie a model in `/marketing` wont be found for a query in `/finance`)
export function lookup (node:SyntaxNode, query:Query, scope:Join | null): LookupResult {
  let pathSegments = node.getChildren('Identifier').map(i => txt(i))
  if (pathSegments.length == 0) {
    pushError(query, node, 'Tried to lookup empty ColumnRef')
    return [null, null]
  }
  let colName = pathSegments.pop()!

  const searchAllTablesInQuery = (name:string): {join: Join, field: Field} | null => {
    let matches = Object.values(query.tables).map(join => {
      let tablish = join.subquery || TABLE_MAP[join.tableName || '']
      let field = tablish ? tablish.fields[name] : undefined
      return {join, field}
    }).filter(a => !!a.field) as {join: Join, field: Field}[]
    if (matches.length == 0) return null
    if (matches.length > 1) {
      pushError(query, node, `Ambiguous reference to ${name}`)
      return null
    }
    return matches[0]
  }

  // `pathSegments` is each dotted piece of the path, excluding the last bit.
  // It should always be a namespace, table, or join. We'll walk through them 1 by 1 to get the appropriate scope for this column.
  for (let part of pathSegments) {
    if (scope) { // our lookup is constrained to a single table (ie, you're in the middle of a dot-join or a measure)
      if (!scope.tableName) {
        pushError(query, node, 'Missing tableName in scope')
        return [null, null]
      }
      let table = TABLE_MAP[scope.tableName]
      if (!table) {
        pushError(query, node, `Unknown table ${scope.tableName}`)
        return [null, null]
      }
      let field = table.fields[part]
      if (!field) {
        pushError(query, node, `Could not find ${part} on table ${scope.tableName}`)
        return [null, null]
      }
      if (field.type != 'join') {
        pushError(query, node, `Expected join '${part}' on table ${scope.tableName}`)
        return [null, null]
      }
      scope = query.tables[field.alias] = field
    } else if (query.tables[part]) { // you're referring to a table joined in to the query. It could be a subquery!
      scope = query.tables[part]
    } else { // this must be the name of a JoinDef in an existing table
      let match = searchAllTablesInQuery(part)
      if (!match) return [null, null]
      if (match.field.type != 'join') {
        pushError(query, node, `Expected join '${part}'`)
        return [null, null]
      }
      scope = query.tables[match.field.alias] = match.field
    }
  }

  // now that we have the scope, we can look at the last part of the path, which should be a column.
  // if we're looking up a column without a path, we need to search all the tables in the query's scope, as well as select aliases
  if (scope) {
    let tablish = scope.subquery || TABLE_MAP[scope.tableName || '']
    if (!tablish) {
      pushError(query, node, `Unknown table ${scope.tableName}`)
      return [null, null]
    }
    if (!tablish.fields[colName]) {
      pushError(query, node, `Couldn't find column ${colName} in ${scope.alias}`)
      return [scope, null]
    }
    return [scope, tablish.fields[colName]]
  } else {
    let match = searchAllTablesInQuery(colName)
    if (!match) {
      pushError(query, node, `Couldn't find column ${colName}`)
      return [null, null]
    }
    return [match.join, match.field]
  }
}
