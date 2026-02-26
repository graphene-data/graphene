import {tidy} from '@tidyjs/tidy'

export function tidyWithTypes (data, ...ops) {
  let result = tidy(data, ...ops)
  if (Array.isArray(data?._evidenceColumnTypes)) {
    result._evidenceColumnTypes = data._evidenceColumnTypes
  }
  return result
}
