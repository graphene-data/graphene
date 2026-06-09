export interface CsvField {
  name: string
}

export function rowsToCsv(rows: Record<string, unknown>[], fields: CsvField[] = []): string {
  let headers = csvHeaders(rows, fields)
  if (headers.length === 0) return ''

  let lines = [headers.map(escapeCsvCell).join(',')]
  for (let row of rows) {
    lines.push(headers.map(header => escapeCsvCell(csvValue(row, header))).join(','))
  }
  return lines.join('\n')
}

function csvHeaders(rows: Record<string, unknown>[], fields: CsvField[]) {
  if (fields.length > 0) return fields.map(field => field.name)

  let headers: string[] = []
  for (let row of rows) {
    for (let key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key)
    }
  }
  return headers
}

function csvValue(row: Record<string, unknown>, header: string) {
  if (Object.hasOwn(row, header)) return row[header]

  let rowKey = Object.keys(row).find(key => key.toLowerCase() == header.toLowerCase())
  return rowKey ? row[rowKey] : undefined
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) value = value.toISOString()
  if (typeof value == 'bigint') value = String(value)
  if (typeof value == 'object') value = JSON.stringify(value)

  let text = String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}
