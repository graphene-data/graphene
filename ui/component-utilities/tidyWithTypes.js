import {tidy} from '@tidyjs/tidy'

export function tidyWithTypes(data, ...ops) {
  let result = tidy(data, ...ops)
  if (Array.isArray(data?._fields)) {
    result._fields = data._fields
  }
  return result
}
