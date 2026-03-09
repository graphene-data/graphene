import {lookupColumnFormat} from './formatting.js'
import formatTitle from './formatTitle.js'
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
 * @property {Object} evidenceColumnType
 * @property {ReturnType<typeof lookupColumnFormat>} format
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

  let types = Array.isArray(data?._evidenceColumnTypes) ? data._evidenceColumnTypes : []

  for (let colName of Object.keys(data[0])) {
    let evidenceColumnType = types.find(item => item.name?.toLowerCase() === colName?.toLowerCase()) ?? {
      name: colName,
      evidenceType: EvidenceType.STRING,
    }
    let type = evidenceColumnType.evidenceType
    let columnUnitSummary = evidenceColumnType.evidenceType === EvidenceType.NUMBER ? getColumnUnitSummary(data, colName, true) : getColumnUnitSummary(data, colName, false)

    if (evidenceColumnType.evidenceType !== EvidenceType.NUMBER) {
      columnUnitSummary.maxDecimals = 0
      columnUnitSummary.unitType = evidenceColumnType.evidenceType
    }
    let format = lookupColumnFormat(colName, evidenceColumnType, columnUnitSummary)

    columnSummary[colName] = {
      title: formatTitle(colName, format),
      type,
      evidenceColumnType,
      format,
      columnUnitSummary,
    }
  }

  if (returnType !== 'object') {
    return Object.entries(columnSummary).map(([key, value]) => ({id: key, ...value}))
  }

  return columnSummary
}
