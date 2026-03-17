// Fanout analysis models expression grain in terms of `join many` paths from the base table.
// For example, `[]` is the base grain, `['orders']` is one row per order, and
// `['orders', 'order_items']` is one row per order item.
export type FanoutPath = string[]

// Fanout metadata carried on an analyzed expression.
export interface ExprFanout {
  path?: FanoutPath // the single row-grain this scalar expression depends on.
  sensitivePaths?: FanoutPath[] // aggregate grains in this expression that are sensitive to row duplication.
  conflict?: boolean // true when scalar subexpressions mix incompatible `join many` branches.
}

export function extendFanoutPath(path: FanoutPath | undefined, segment?: string | null): FanoutPath {
  if (!segment) return [...(path || [])]
  return [...(path || []), segment]
}

// Normalize empty fanout objects away so "missing" continues to mean "no fanout metadata".
export function normalizeExprFanout(exprFanout: ExprFanout): ExprFanout | undefined {
  if (exprFanout.sensitivePaths?.length == 0) delete exprFanout.sensitivePaths
  if (!exprFanout.conflict) delete exprFanout.conflict
  if (exprFanout.path == null && !exprFanout.sensitivePaths && !exprFanout.conflict) return
  return exprFanout
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

export function describeFanoutTarget(path: FanoutPath | undefined): string {
  return path?.[path.length - 1] || 'base table'
}

export function fanoutMessage(path: FanoutPath | undefined, suffix: string): string {
  return `Expression is fanned out by join to table \`${describeFanoutTarget(path)}\`; ${suffix}`
}

export function aggregateFanoutMessage(label: string, path: FanoutPath | undefined): string {
  return `Aggregate expression \`${label}\` is fanned out by join to table \`${describeFanoutTarget(path)}\``
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

export function isPrefix(prefix: FanoutPath, path: FanoutPath): boolean {
  if (prefix.length > path.length) return false
  return prefix.every((part, i) => part == path[i])
}

export function isChasmTrap(paths: FanoutPath[]): boolean {
  if (paths.length <= 1 || paths.some(path => path.length == 0)) return false
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (isPrefix(paths[i], paths[j]) || isPrefix(paths[j], paths[i])) return false
    }
  }
  return true
}

export function multiGrainMessage(paths: FanoutPath[]): string {
  if (isChasmTrap(paths)) return `Join graph creates a chasm trap (${formatGrains(paths)}). Aggregate each path in a subquery/CTE first`
  return `One or more aggregate expressions fanned out by join graph (${formatGrains(paths)}). Aggregate each grain in a subquery/CTE first`
}
