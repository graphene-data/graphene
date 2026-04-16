import {formatTitle} from './format.ts'
import {getColumnUnitSummary} from './getColumnExtents.js'

const EvidenceType = {
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  STRING: 'string',
  DATE: 'date',
}

/**
 * @typedef {Object} ColumnSummary
 * @property {string} title
 * @property {string} type
 * @property {{name: string, type: string, metadata?: Record<string, unknown>}} field
 * @property {ReturnType<typeof getColumnUnitSummary>} columnUnitSummary
 */

/**
 * @function
 * @template T
 * @param {Record<string, unknown>[]} rows
 * @param {{name: string, type: string, metadata?: Record<string, unknown>}[]} fields
 * @param {T} returnType
 * @returns {T extends 'object' ? Record<string, ColumnSummary> : (ColumnSummary & { id: string })[]}
 */
export default function getColumnSummary(rows, fields, returnType = 'object') {
  /** @type {Record<string, ColumnSummary>} */
  let columnSummary = {}

  if (!Array.isArray(fields) || fields.length === 0) throw new Error('Table data is missing field metadata.')
  if (!Array.isArray(rows) || rows.length === 0) return returnType !== 'object' ? [] : {}

  for (let colName of Object.keys(rows[0])) {
    let field = fields.find(item => item?.name?.toLowerCase() === colName?.toLowerCase())
    let type = inferTypeFromField(field)
    let isNumeric = type === EvidenceType.NUMBER
    let columnUnitSummary = getColumnUnitSummary(rows, colName, isNumeric)

    if (!isNumeric) {
      columnUnitSummary.maxDecimals = 0
      columnUnitSummary.unitType = type
    }

    columnSummary[colName] = {
      title: formatTitle(colName),
      type,
      field: {
        name: colName,
        type,
        metadata: field?.metadata,
      },
      columnUnitSummary,
    }
  }

  if (returnType !== 'object') {
    return Object.entries(columnSummary).map(([key, value]) => ({id: key, ...value}))
  }

  return columnSummary
}

function inferTypeFromField(field) {
  let type = String(field?.type || '').toLowerCase()
  if (type === 'number') return EvidenceType.NUMBER
  if (type === 'boolean') return EvidenceType.BOOLEAN
  if (type === 'date' || type === 'timestamp') return EvidenceType.DATE
  if (type === 'string') return EvidenceType.STRING
  return EvidenceType.STRING
}
