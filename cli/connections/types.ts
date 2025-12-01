export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
}

export interface SchemaColumn {
  name: string
  dataType: string
}

export interface QueryConnection {
  runQuery(sql: string): Promise<QueryResult>
  listDatasets(): Promise<string[]>
  listTables(dataset?: string): Promise<string[]>
  describeTable(table: string): Promise<SchemaColumn[]>
}
