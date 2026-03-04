export default function getSortedData(data, col, isAsc) {
  let res = [...data].sort((a, b) => {
    return (a[col] < b[col] ? -1 : 1) * (isAsc ? 1 : -1)
  })
  if (Array.isArray(data?._evidenceColumnTypes)) {
    res._evidenceColumnTypes = data._evidenceColumnTypes
  }
  return res
}
