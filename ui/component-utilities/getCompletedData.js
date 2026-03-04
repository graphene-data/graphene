import {tidy, complete} from '@tidyjs/tidy'
import getDistinctValues from './getDistinctValues'
import {findInterval, vectorSeq} from './helpers/getCompletedData.helpers.js'

/**
 * This function fills missing data points in the given data array for a specific series.
 *
 * @param {Record<string, unknown>[]} _data - The data as an array of objects.
 * @param {string} x - The property used as x-axis.
 * @param {string} y - The property used as y-axis.
 * @param {string} series - The specific series in the data to be filled.
 * @param {boolean} [nullsZero=false] - A flag indicating whether nulls should be replaced with zero.
 * @param {boolean} [fillX=false] - A flag indicating whether the x-axis values should be filled (based on the found interval distance).
 * @return {Record<string, unknown>[]} An array containing the filled data objects.
 */
export default function getCompletedData(_data, x, y, series, nullsZero = false, fillX = false) {
  let xIsDate = false
  let data = _data
    .map((d) =>
      Object.assign({}, d, {
        [x]: d[x] instanceof Date ? ((xIsDate = true), d[x].toISOString()) : d[x],
      }),
    )
    .filter((d) => d[x] !== undefined && d[x] !== null)
  let groups = Array.from(data).reduce((a, v) => {
    if (v[x] instanceof Date) {
      v[x] = v[x].toISOString()
      xIsDate = true
    }
    if (series) {
      if (!a[v[series] ?? 'null']) a[v[series] ?? 'null'] = []
      a[v[series] ?? 'null'].push(v)
    } else {
      if (!a.default) a.default = []
      a.default.push(v)
    }
    return a
  }, {})

  // Ensures that all permutations of this map exist in the output
  // e.g. can include series and x values to ensure that all series have all x values
  let expandKeys = {}

  /** @type {Array<number | string>} */
  let xDistinct

  let exampleX =
    data.find((item) => item && item[x] !== null && item[x] !== undefined)?.[x] ?? null
  // const exampleX = data[0]?.[x];
  switch (typeof exampleX) {
    case 'object':
      if (exampleX === null) {
        throw new Error(
          `Column '${x}' is entirely null. Column must contain at least one non-null value.`,
        )
      } else {
        throw new Error('Unexpected object property, expected string, date, or number')
      }
    case 'number':
      // Numbers are the most straightforward
      xDistinct = getDistinctValues(data, x)
      if (fillX) {
        // Attempt to derive the interval between X values and interpolate missing values in that set (within the bounds of min/max)
        let interval = findInterval(xDistinct)
        expandKeys[x] = vectorSeq(xDistinct, interval)
      }
      break
    case 'string':
      xDistinct = getDistinctValues(data, x)
      expandKeys[x] = xDistinct
      break
  }

  let output = []

  for (let value of Object.values(groups)) {
    let nullySpec = series ? {[series]: null} : {}
    if (nullsZero) {
      if (y instanceof Array) {
        for (let i = 0; i < y.length; i++) {
          nullySpec[y[i]] = 0
        }
      } else {
        nullySpec[y] = 0
      }
    } else {
      // Ensure null for consistency
      if (y instanceof Array) {
        for (let i = 0; i < y.length; i++) {
          nullySpec[y[i]] = null
        }
      } else {
        nullySpec[y] = null
      }
    }

    if (series) {
      expandKeys[series] = series
    }

    let tidyFuncs = []
    if (Object.keys(expandKeys).length === 0) {
      // empty object, no special configuration
      tidyFuncs.push(complete([x], nullySpec))
    } else {
      tidyFuncs.push(complete(expandKeys, nullySpec))
    }

    output.push(tidy(value, ...tidyFuncs))
  }
  if (xIsDate) {
    let converted = output.flat().map((r) => ({...r, [x]: new Date(r[x])}))
    if (Array.isArray(_data?._evidenceColumnTypes)) {
      converted._evidenceColumnTypes = _data._evidenceColumnTypes
    }
    return converted
  }

  let flattened = output.flat()
  if (Array.isArray(_data?._evidenceColumnTypes)) {
    flattened._evidenceColumnTypes = _data._evidenceColumnTypes
  }
  return flattened
}
