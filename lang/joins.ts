import type {SyntaxNode} from '@lezer/common'

import type {Query, QueryJoin, Scope, Table} from './types.ts'

import {extendFanoutPath} from './fanout.ts'
import {txt} from './util.ts'

// Ad-hoc query joins do not carry modeled cardinality, but the fanout checker needs one.
// This function tries to recognize when an explicit `JOIN ... ON ...` is structurally the
// same relationship as a modeled join already available from one of the query's source tables.
// If it finds exactly one match, it reuses that join's cardinality/locality. Otherwise it
// leaves the join in the conservative fallback state used by fanout analysis.
export function inferAdHocJoinLocality(join: QueryJoin, query: Query, scope: Scope, lookupTable: (node: SyntaxNode, scope?: Scope) => Table | undefined) {
  if (!join.table || !join.onExpr) {
    join.localityPath = [join.alias]
    return
  }

  let candidates: {cardinality: 'one' | 'many'; localityPath: string[]}[] = []
  for (let source of query.joins.filter(qj => qj != join && qj.table)) {
    let joinTarget = {name: join.alias, table: join.table, alias: join.alias}
    let explicitSig = buildJoinSignature(join.onExpr, {
      query,
      table: source.table!,
      alias: source.alias,
      localityPath: source.localityPath,
      otherTables: scope.otherTables,
      joinTarget,
    })
    if (!explicitSig) continue

    for (let modeled of source.table!.joins) {
      modeled.table = lookupTable(modeled.targetNode!)
      if (!modeled.table || modeled.table.name != join.table.name) continue

      let modeledTarget = {name: modeled.alias, table: join.table, alias: join.alias}
      let modeledSig = buildJoinSignature(modeled.onExpr!, {
        query,
        table: source.table!,
        alias: source.alias,
        localityPath: source.localityPath,
        otherTables: scope.otherTables,
        joinTarget: modeledTarget,
      })
      if (!modeledSig || !joinSignaturesEqual(explicitSig, modeledSig)) continue

      let localityPath = modeled.cardinality == 'many' ? extendFanoutPath(source.localityPath, join.alias) : extendFanoutPath(source.localityPath)
      candidates.push({cardinality: modeled.cardinality!, localityPath})
    }
  }

  if (candidates.length != 1) {
    join.localityPath = [join.alias]
    return
  }

  join.cardinality = candidates[0].cardinality
  join.localityPath = candidates[0].localityPath
}

function buildJoinSignature(node: SyntaxNode, scope: Scope): string[] | null {
  let comparisons = flattenJoinComparisons(node)
  if (!comparisons) return null

  let parts: string[] = []
  for (let comparison of comparisons) {
    let left = resolveJoinOperand(comparison.firstChild!, scope)
    let right = resolveJoinOperand(comparison.lastChild!, scope)
    if (!left || !right) return null
    if (left.role == right.role) return null

    let source = left.role == 'source' ? left : right
    let target = left.role == 'target' ? left : right
    parts.push(`${source.path.join('.')}=${target.path.join('.')}`)
  }

  return parts.sort()
}

function flattenJoinComparisons(node: SyntaxNode): SyntaxNode[] | null {
  if (node.name == 'Parenthetical') return flattenJoinComparisons(node.getChild('Expression')!)
  let op = txt(node.firstChild?.nextSibling).toLowerCase()
  if ((node.name == 'BinaryExpression' || node.name == 'AndExpression') && op == 'and') {
    let left = flattenJoinComparisons(node.firstChild!)
    let right = flattenJoinComparisons(node.lastChild!)
    if (!left || !right) return null
    return [...left, ...right]
  }
  if ((node.name == 'ComparisonExpression' || node.name == 'BinaryExpression') && op == '=') return [node]
  return null
}

function resolveJoinOperand(node: SyntaxNode, scope: Scope): {role: 'source' | 'target'; path: string[]} | null {
  if (node.name == 'Parenthetical') return resolveJoinOperand(node.getChild('Expression')!, scope)
  if (node.name != 'Ref') return null

  let parts = node.getChildren('Identifier').map(n => txt(n))
  if (parts.length == 0) return null

  if (parts.length == 1) {
    let field = parts[0]
    if (!scope.table?.columns.some(c => c.name == field)) return null
    return {role: 'source', path: [field]}
  }

  let [head, ...rest] = parts
  if (head == scope.alias || head == scope.table?.name) return {role: 'source', path: rest}
  if (scope.joinTarget && (head == scope.joinTarget.alias || head == scope.joinTarget.name)) {
    return {role: 'target', path: rest}
  }
  return null
}

function joinSignaturesEqual(left: string[], right: string[]): boolean {
  if (left.length != right.length) return false
  return left.every((part, i) => part == right[i])
}
