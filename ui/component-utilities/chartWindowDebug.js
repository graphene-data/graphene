const s = Symbol.for('__evidence-chart-window-debug__')
const isBrowser = typeof window !== 'undefined'

/**
 * @param {string} key
 * @param {unknown} value
 */
export const set = (key, value) => {
  if (!isBrowser) return
  if (!window[s]) window[s] = {}
  window[s][key] = value
}

/**
 * @param {string} key
 */
export const unset = (key) => {
  if (!isBrowser) return
  if (!window[s]) window[s] = {}
  delete window[s][key]
}
