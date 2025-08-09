import {Query, TABLE_MAP, txt, type Join, type Computed, type Column} from './core.ts'
import type {SyntaxNode} from '@lezer/common'

type Field = Column | Join | Computed

type LookupResult = [Join | null, Field | null]

// Takes a column ref like `someCol` or `tableA.joinB.otherCol` and finds it.
// This returns a Join, telling us which table within the query we're pointing to, and the Field.
// We need a Join rather than Table, because the table might have an alias in this query, or be a subquery.
// As we traverse, joins are automatically added to the query as needed.
// scope is used because once you traverse through a join, we only want to look at columns within that join.
//
// Eventually, we may also want this to handle model definition scope, where the tables it searches are constrained
// by the relative paths where those tables are defined (ie a model in `/marketing` wont be found for a query in `/finance`)
export function lookup (node:SyntaxNode, query:Query, scope:Join | null): LookupResult {
  let pathSegments = node.getChildren('Identifier').map(i => txt(i))
  if (pathSegments.length == 0) throw new Error('called lookup on an empty ColumnRef')
  let colName = pathSegments.pop()!

  let searchAllTablesInQuery = (name:string): {join: Join, field: Field} | null => {
    let matches = Object.values(query.tables).map(join => {
      let tablish = join.subquery || TABLE_MAP[join.tableName || '']
      let field = tablish ? tablish.fields[name] : undefined
      return {join, field}
    }).filter(a => !!a.field) as {join: Join, field: Field}[]
    if (matches.length == 0) {
      query.diag(node, `Couldn't find column ${name}`)
      return null
    }
    if (matches.length > 1) {
      query.diag(node, `Ambiguous reference to ${name}`)
      return null
    }
    return matches[0]
  }

  // `pathSegments` is each dotted piece of the path, excluding the last bit. For example, `tableA.joinB.otherCol` it would be `['tableA', 'joinB']`
  // It should always be a namespace, table, or join. We'll walk through them one by one to get the appropriate scope for this column.
  for (let part of pathSegments) {
    if (scope) {
      // if there's a scope, we're constrained to an existing table/model. This should always exist.
      if (!scope.tableName) throw new Error('Missing tableName in scope')
      let table = TABLE_MAP[scope.tableName]
      if (!table) throw new Error('Couldnt find table from a scope')

      let field = table.fields[part]
      if (!field) {
        query.diag(node, `Could not find ${part} on table ${scope.tableName}`)
        return [null, null]
      }
      if (field.type != 'join') {
        query.diag(node, `Expected '${part}' to be a join on table ${scope.tableName}`)
        return [null, null]
      }
      scope = query.tables[field.alias] = field
    } else if (query.tables[part]) { // you're referring to a table (or subquery alias) joined in to the query.
      scope = query.tables[part]
    } else { // this must be the name of a Join in an existing table
      let match = searchAllTablesInQuery(part)
      if (!match) return [null, null]
      if (match.field.type != 'join') {
        query.diag(node, `Expected '${part}' to be a join`)
        return [null, null]
      }
      scope = query.tables[match.field.alias] = match.field
    }
  }

  // now that we have the scope, we can look at the last part of the path, which should be a column.
  // if we're looking up a column without a path, we need to search all the tables in the query's scope, as well as select aliases
  if (scope) {
    let tablish = scope.subquery || TABLE_MAP[scope.tableName || '']
    if (!tablish) throw new Error('scope pointed to nonexistant table')

    if (!tablish.fields[colName]) {
      query.diag(node, `Couldn't find column ${colName} in ${scope.alias}`)
      return [scope, null]
    }
    return [scope, tablish.fields[colName]]
  } else {
    let match = searchAllTablesInQuery(colName)
    if (!match) return [null, null]
    return [match.join, match.field]
  }
}
