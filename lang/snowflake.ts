import {walkExpression} from './util.ts'
import type {Table, Field, Expression, Join} from './types.ts'

// We like writing gsql with lower or camel case, but snowflake defaults to ALL_CAPS_FOR_EVERYTHING.
// To work around this, we tweak the query just before we send it to Malloy to use uppercase names for columns and tables.
// We do this by changing their `name` to uppercase, and setting `as` to be the version gsql expects, so lowercase downstream queries work just fine.
// For tables, we change the `tablePath` to uppercase.

export function uppercaseTable (table: Table) {
  if ((table as any).upperCased) return
  (table as any).upperCased = true

  if (table.query) return // query tables don't have actual columns in the db

  table.tablePath = uppercaseIdentifier(table.tablePath)
  table.fields.forEach(uppercaseField)
}

// This is a bit fiddly. Join fields are each distinct copies of the table, but the _fields_ in each join are shared.
// That means we need to process every table and join, but fields could get hit multiple times if there are different paths to them.
function uppercaseField (field: Field) {
  // Remember that each join field is a distinct partial copy of the table, so we need to uppercase each one.
  if (isJoinField(field)) return uppercaseTable(field as any)

  // It's possible we'll visit the same field multiple times, since multiple joins can share the same child `field` object
  // Processing multiple times would be wrong, as it would uppercase the `as` the second time
  if ((field as any).upperCased) return
  (field as any).upperCased = true


  if (field.e) return uppercaseExpression(field.e)

  ;(field as any).as = field.name
  field.name = uppercaseIdentifier(field.name)
}

function uppercaseExpression (expr?: Expression) {
  if (!expr) return
  walkExpression(expr, (node: any) => {
    if (node.type == 'field') {
      node.path = node.path.map(uppercaseIdentifier)
    }
  })
}

function uppercaseIdentifier (value?: string): string {
  if (!value) return value || ''
  return value.toString().toUpperCase()
}

function isJoinField (field: Field): field is Join {
  return !!(field as any)?.join
}
