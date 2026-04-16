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
 * @param {Record<string, unknown>[]} data
 * @param {T} returnType
 * @returns {T extends 'object' ? Record<string, ColumnSummary> : (ColumnSummary & { id: string })[]}
 */
export default function getColumnSummary(data, returnType = 'object') {
  /** @type {Record<string, ColumnSummary>} */
  let columnSummary = {}

  let fields = Array.isArray(data?._fields) ? data._fields : []
  if (fields.length === 0) throw new Error('Table data is missing field metadata. Expected rows._fields to be set.')

  for (let colName of Object.keys(data[0])) {
    let field = fields.find(item => item?.name?.toLowerCase() === colName?.toLowerCase())
    let type = inferTypeFromField(field)
    let isNumeric = type === EvidenceType.NUMBER
    let columnUnitSummary = getColumnUnitSummary(data, colName, isNumeric)

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
