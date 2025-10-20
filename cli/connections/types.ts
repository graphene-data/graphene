
export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
}

export interface QueryConnection {
  runQuery(sql: string): Promise<QueryResult>
}
