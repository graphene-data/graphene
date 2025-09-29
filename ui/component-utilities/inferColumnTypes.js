// To-do, replace with import from db-commons

export const EvidenceType = {
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  STRING: 'string',
  DATE: 'date',
}

export const TypeFidelity = {
  INFERRED: 'inferred',
  PRECISE: 'precise',
}

export const inferValueType = (columnValue) => {
  if (typeof columnValue === 'number') {
    return EvidenceType.NUMBER
  } else if (typeof columnValue === 'boolean') {
    return EvidenceType.BOOLEAN
  } else if (columnValue instanceof Date) {
    return EvidenceType.DATE
  } else {
    return EvidenceType.STRING
  }
}

export default function inferColumnTypes (rows) {
  if (rows?._evidenceColumnTypes) {
    return rows._evidenceColumnTypes
  }
  if (rows && rows.length > 0) {
    let columns = Object.keys(rows[0])
    let columnTypes = columns?.map((column) => {
      let firstRowWithColumnValue = rows.find((element) =>
        element[column] == null ? false : true,
      )
      if (firstRowWithColumnValue) {
        let inferredType = inferValueType(firstRowWithColumnValue[column])
        return {name: column, evidenceType: inferredType, typeFidelity: TypeFidelity.INFERRED}
      } else {
        return {
          name: column,
          evidenceType: EvidenceType.STRING,
          typeFidelity: TypeFidelity.INFERRED,
        }
      }
    })
    return columnTypes
  }
  return []
}
