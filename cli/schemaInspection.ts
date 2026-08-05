// Schema inspection is shared by the local CLI and Graphene Cloud so both paths interpret
// database hierarchies identically. The caller owns the warehouse connection and renders the result.
import {parseWarehouseFieldType} from '../lang/types.ts'
import {type QueryConnection, type SchemaColumn} from './connections/types.ts'

export interface SchemaContext {
  dialect: string
  defaultNamespace?: string
}

export type SchemaInspection =
  | {kind: 'datasets'; datasets: string[]}
  | {kind: 'schemas'; dataset: string; schemas: string[]}
  | {kind: 'tables'; dataset: string; tables: string[]}
  | {kind: 'table'; table: string; columns: SchemaColumn[]}

// Resolve whether the user requested datasets, schemas, tables, or columns, then inspect the warehouse.
export async function inspectSchema(connection: QueryConnection, context: SchemaContext, tableArg?: string): Promise<SchemaInspection> {
  let datasets = await connection.listDatasets()
  let matchedDataset = tableArg ? findCaseInsensitive(datasets, tableArg) : null

  if (!tableArg && !context.defaultNamespace && datasets.length > 1) return {kind: 'datasets', datasets}

  let dataset: string | null = null
  let parts = tableArg ? tableArg.split('.') : []

  if (tableArg && connection.listSchemas && parts.length == 1 && matchedDataset) {
    return {kind: 'schemas', dataset: matchedDataset, schemas: await connection.listSchemas(matchedDataset)}
  }

  if (matchedDataset) dataset = matchedDataset
  else if (!tableArg && context.defaultNamespace) dataset = context.defaultNamespace
  else if (!tableArg && datasets.length == 1) dataset = datasets[0]
  else if (!tableArg && context.dialect == 'duckdb') dataset = '<default>'
  else if (tableArg && context.dialect == 'duckdb' && datasets.length && parts.length == 2) dataset = tableArg
  else if (tableArg && context.dialect == 'snowflake' && parts.length == 2) {
    let database = findCaseInsensitive(datasets, parts[0])
    if (database) dataset = `${database}.${parts.slice(1).join('.')}`
  }

  if (dataset) return {kind: 'tables', dataset, tables: await connection.listTables(dataset)}

  let target = qualifyTable(tableArg || '', context)
  let columns = await connection.describeTable(target)
  let table = context.dialect == 'snowflake' ? String(tableArg || '').toLowerCase() : String(tableArg || '')
  return {kind: 'table', table, columns}
}

// Render structured inspection results in the established gsql-like CLI format.
export function printSchemaInspection(result: SchemaInspection): void {
  if (result.kind == 'datasets') return console.log(`Datasets available:\n${result.datasets.join('\n')}`)
  if (result.kind == 'schemas') return console.log(`Schemas in ${result.dataset}:\n${result.schemas.join('\n')}`)
  if (result.kind == 'tables') return console.log(`Tables in ${result.dataset}:\n${result.tables.join('\n')}`)
  if (!result.columns.length) return console.log(`Table ${result.table} not found`)

  console.log(`table ${result.table} (`)
  result.columns.forEach(column => {
    let parsed = parseWarehouseFieldType(column.dataType)
    console.log(`  ${column.name} ${parsed.displayType || column.dataType}`)
  })
  console.log(')')
}

// Apply the configured namespace when connectors cannot infer it from an unqualified table name.
function qualifyTable(table: string, context: SchemaContext): string {
  if (!context.defaultNamespace) return table
  if (!table.includes('.')) return `${context.defaultNamespace}.${table}`
  if (context.dialect == 'snowflake' && table.split('.').length == 2) return `${context.defaultNamespace.split('.')[0]}.${table}`
  return table
}

function findCaseInsensitive(values: string[], needle: string): string | null {
  return values.find(value => value.toLowerCase() == needle.toLowerCase()) || null
}
