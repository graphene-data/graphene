import type {FieldType, Query} from './types.ts'

// Converts analyzed $params into SQL literals without changing the generated query structure.
// Adaptive list predicates already contain both mode branches; synthetic mode params select one at runtime.
export function fillInParams(query: Query, params: Record<string, any>) {
  query.sql = replaceParams(query.sql, params, query.dialect, query.paramTypes)
}

// Replace scalar/list values and analyzer-generated mode params while leaving quoted SQL strings untouched.
function replaceParams(sql: string, params: Record<string, any>, dialect?: string, paramTypes: Query['paramTypes'] = {}): string {
  // Alternation: match single-quoted strings (including escaped '') first, then $params.
  // Synthetic mode params let analyzed IN expressions switch operators without rewriting SQL at runtime.
  return sql.replace(/'(?:[^']|'')*'|\$(\w+)/g, (match, name) => {
    if (!name) return match
    if (name.startsWith('__graphene_list_mode_')) return `'${listParam(params[name.slice('__graphene_list_mode_'.length)]).mode}'`
    let value = listParam(params[name]).values
    if (value === undefined) throw new Error(`Missing param $${name}`)
    if (Array.isArray(value)) {
      if (!value.length) return emptyArraySql(dialect, paramTypes[name])
      return value.map(item => renderParam(item, name, dialect)).join(',')
    }
    return renderParam(value, name, dialect)
  })
}

// Render only scalar JSON values. Coercing nested arrays or objects with String() would put
// their contents into SQL without quoting and allow them to change the query structure.
function renderParam(value: unknown, name: string, dialect?: string): string {
  if (value === null) return 'NULL'
  if (typeof value === 'string') {
    let escaped = dialect == 'clickhouse' ? value.replace(/\\/g, '\\\\').replace(/'/g, "''") : value.replace(/'/g, "''")
    return `'${escaped}'`
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  throw new Error(`Unsupported param value for $${name}`)
}

// List params carry a compact-set mode; ordinary values remain include-mode params for compatibility.
function listParam(value: any): {mode: 'include' | 'exclude'; values: any} {
  if (!value || typeof value != 'object' || Array.isArray(value)) return {mode: 'include', values: value}
  if ((value.mode && value.mode != 'include' && value.mode != 'exclude') || !Array.isArray(value.values)) throw new Error('List param requires include/exclude mode and array values')
  return {mode: value.mode || 'include', values: value.values}
}

// Generate a typed zero-row subquery where the dialect requires one for IN comparisons.
function emptyArraySql(dialect: string | undefined, type: FieldType | undefined) {
  if (dialect != 'bigquery' || typeof type != 'string') return 'SELECT NULL WHERE FALSE'
  let bigQueryType = {string: 'STRING', number: 'FLOAT64', boolean: 'BOOL', date: 'DATE', time: 'TIME', timestamp: 'TIMESTAMP'}[type]
  return bigQueryType ? `SELECT CAST(NULL AS ${bigQueryType}) WHERE FALSE` : 'SELECT NULL WHERE FALSE'
}
