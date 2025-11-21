import {walkExpression} from './util.ts'
import type {Table, Field, ColumnField, Expression, Query, Join} from './types.ts'

/**
 * Malloy treats identifier case literally when compiling Snowflake SQL. Rather than rewrite the final SQL string,
 * walk the already-cloned tables and query in-place so every consumer (CLI output, caching, connections) observes the
 * same uppercase representation.
 */

export function uppercaseMalloyQuery (query: Query) {
  query.baseTableName = uppercaseIdentifier(query.baseTableName)
  for (let stage of query.pipeline || []) {
    let fields = (stage as any).queryFields || []
    fields.forEach((field: ColumnField) => uppercaseColumnField(field))

    let filters = (stage as any).filterList || []
    filters.forEach((filter: any) => uppercaseExpression(filter?.e))
  }
}

export function uppercaseTable (table: Table) {
  if ((table as any).upperCased) return
  (table as any).upperCased = true

  table.name = uppercaseIdentifier(table.name)
  if (table.primaryKey) table.primaryKey = uppercaseIdentifier(table.primaryKey)
  if (table.tableName) table.tableName = uppercaseQualified(table.tableName)
  if (table.tablePath) table.tablePath = uppercaseQualified(table.tablePath)

  table.fields?.forEach(field => uppercaseField(field))
  if (table.query) uppercaseMalloyQuery(table.query)
}

function uppercaseField (field: Field) {
  if (!field) return
  if (isJoinField(field)) {
    field.name = uppercaseIdentifier(field.name)
    if (field.tableName) field.tableName = uppercaseQualified(field.tableName)
    if (field.tablePath) field.tablePath = uppercaseQualified(field.tablePath)
    if ((field as any).structPath) (field as any).structPath = (field as any).structPath!.map(uppercaseIdentifier)
    if ((field as any).path) (field as any).path = (field as any).path!.map(uppercaseIdentifier)
    if (field.onExpression) uppercaseExpression(field.onExpression as Expression)
    uppercaseTable(field as unknown as Table)
  } else {
    uppercaseColumnField(field as ColumnField)
  }
}

function uppercaseColumnField (field: ColumnField) {
  if (!field) return
  field.name = uppercaseIdentifier(field.name)
  if (field.path) field.path = field.path.map(uppercaseIdentifier)
  if ((field as any).structPath) (field as any).structPath = (field as any).structPath.map(uppercaseIdentifier)
  if ((field as any).tableName) (field as any).tableName = uppercaseQualified((field as any).tableName)
  if ((field as any).tablePath) (field as any).tablePath = uppercaseQualified((field as any).tablePath)
  if (field.e) uppercaseExpression(field.e)
}

function uppercaseExpression (expr?: Expression) {
  if (!expr) return
  walkExpression(expr, (node: any) => {
    if (Array.isArray(node.path)) node.path = node.path.map(uppercaseIdentifier)
    if (Array.isArray(node.structPath)) node.structPath = node.structPath.map(uppercaseIdentifier)
  })
}

function uppercaseIdentifier (value?: string): string {
  if (!value) return value || ''
  return value.toString().toUpperCase()
}

function uppercaseQualified (value?: string): string | undefined {
  if (!value) return value
  return value.split('.').map(part => part.startsWith('"') && part.endsWith('"') ? part : uppercaseIdentifier(part)).join('.')
}

function isJoinField (field: Field): field is Join {
  return !!(field as any)?.join
}
