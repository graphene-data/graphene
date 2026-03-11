// Fanout analysis tracks the implied grain of an expression using join-path metadata.
//
// A `FanoutPath` is the sequence of `join many` edges taken from the current base table
// to reach the rows an expression depends on. Examples:
// - `[]` means the base table grain.
// - `['orders']` means one row per order relative to the base table.
// - `['orders', 'order_items']` means one row per order item.
//
// Expression analysis uses these helpers in two ways:
// - `fanoutPath` on an expression tracks the single row-grain that scalar logic is currently
//   operating at. If two scalar subexpressions come from incomparable `join many` branches,
//   that is a conflict.
// - `fanoutSensitivePaths` tracks the grains of aggregate expressions that are sensitive to
//   row duplication. If one query/measure accumulates more than one such path, we diagnose it
//   and ask the user to aggregate each grain explicitly in a subquery/CTE first.
export type FanoutPath = string[]

export function extendFanoutPath(path: FanoutPath | undefined, segment?: string | null): FanoutPath {
  if (!segment) return [...(path || [])]
  return [...(path || []), segment]
}

export function isBaseFanoutPath(path: FanoutPath | undefined): boolean {
  return !path || path.length == 0
}

export function fanoutPathKey(path: FanoutPath | undefined): string {
  return isBaseFanoutPath(path) ? '__base__' : path!.join('.')
}

export function formatFanoutPath(path: FanoutPath | undefined): string {
  return isBaseFanoutPath(path) ? 'base' : path!.join('.')
}

export function formatGrains(paths: FanoutPath[]) {
  return uniqueFanoutPaths(paths).map(formatFanoutPath).join(', ')
}

export function mergeFanoutPaths(paths: (FanoutPath | undefined)[]): {path?: FanoutPath; conflict?: boolean} {
  let merged: FanoutPath | undefined
  for (let path of paths) {
    if (!path) continue
    if (!merged) {
      merged = [...path]
      continue
    }
    if (isPrefix(merged, path)) {
      merged = [...path]
      continue
    }
    if (isPrefix(path, merged)) continue
    return {conflict: true}
  }
  return {path: merged}
}

export function uniqueFanoutPaths(paths: FanoutPath[]): FanoutPath[] {
  let seen = new Set<string>()
  let unique: FanoutPath[] = []
  for (let path of paths) {
    let key = fanoutPathKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push([...path])
  }
  return unique
}

export function mergeSensitiveFanouts(...paths: (FanoutPath[] | undefined)[]): FanoutPath[] {
  return uniqueFanoutPaths(paths.flatMap(path => path || []))
}

function isPrefix(prefix: FanoutPath, path: FanoutPath): boolean {
  if (prefix.length > path.length) return false
  return prefix.every((part, i) => part == path[i])
}
