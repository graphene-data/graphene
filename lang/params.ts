import type {Expression, FieldType} from './types.ts'
import {walkExpression} from './util.ts'
import {type Query as MalloyQuery} from '@malloydata/malloy'

export function inferParamTypes (query: MalloyQuery) {
  // walk through a query looking for params. When we find one, look at the surrounding expression to figure out
  // the right type, and set that type on the node.
  // While walking you'll want to keep track of the parent node, since that will usually have the context you need
  let parentMap = new WeakMap<object, Expression | null>()

  let inspect = (expr?: Expression) => {
    if (!expr) return
    walkExpression(expr, (node, parent) => {
      parentMap.set(node, parent ?? null)
      if (node.node !== 'parameter') return
      let inferred = inferTypeFromParents(node, parentMap)
      if (inferred) node.type = inferred
    })
  }

  for (let stage of query.pipeline || []) {
    let filters = (stage as any)?.filterList || []
    filters.forEach((f: any) => inspect(f?.e))

    let fields = (stage as any)?.queryFields || []
    fields.forEach((field: any) => inspect(field?.e))
  }
}

const COMPARISON_OPS = new Set(['=', '!=', '<>', '>', '>=', '<', '<=', 'like', 'ilike'])
const BOOLEAN_OPS = new Set(['and', 'or'])
const NUMERIC_UNARY_OPS = new Set(['unary-'])

function inferTypeFromParents (expr: Expression, parents: WeakMap<object, Expression | null>): FieldType | undefined {
  let current = parents.get(expr) || null
  while (current) {
    let inferred = inferFromImmediateParent(expr, current)
    if (inferred) return inferred
    current = parents.get(current) || null
  }
  return undefined
}

function inferFromImmediateParent (expr: Expression, parent: Expression): FieldType | undefined {
  let node = typeof parent.node == 'string' ? parent.node : ''
  if (COMPARISON_OPS.has(node)) {
    let sibling = getBinarySibling(parent, expr)
    let siblingType = sibling?.type
    if (siblingType) return sanitizeType(siblingType)
  }

  if (node === 'in') {
    let kids = (parent as any)?.kids || {}
    let lhs: Expression | undefined = kids.e
    let values: Expression[] = Array.isArray(kids.oneOf) ? kids.oneOf : []
    if (values.includes(expr)) {
      if (values.length === 1) {
        let elementType = lhs?.type && sanitizeType(lhs.type)
        if (elementType) (expr as any).paramElementType = elementType
        return 'array'
      }
      return lhs?.type && sanitizeType(lhs.type) || undefined
    }
    if (lhs === expr && values.length) {
      let example = values.find(v => v !== expr)
      let exampleType = example?.type && sanitizeType(example.type)
      if (exampleType) return exampleType
    }
  }

  if (BOOLEAN_OPS.has(node)) return 'boolean'
  if (node === 'not') return 'boolean'

  if (NUMERIC_UNARY_OPS.has(node)) return 'number'

  if (node === 'function_call') {
    let kids = (parent as any)?.kids || {}
    let args: Expression[] = Array.isArray(kids.args) ? kids.args : []
    let idx = args.indexOf(expr)
    if (idx >= 0) {
      let overload = (parent as any)?.overload
      let param = overload?.params?.[idx]
      if (!param && overload?.params?.length) {
        let last = overload.params[overload.params.length - 1]
        if (last?.isVariadic) param = last
      }
      let fromOverload = typeof param?.type == 'string' ? sanitizeType(param.type) : undefined
      if (fromOverload) return fromOverload
    }
  }

  if (node === 'aggregate' && (parent as any)?.e === expr) {
    let fn = ((parent as any)?.function || '').toLowerCase()
    if (fn === 'sum' || fn === 'avg') return 'number'
    if (fn === 'count') return 'number'
  }

  if (node === 'case') {
    let kids = (parent as any)?.kids || {}
    let caseWhen: Expression[] = Array.isArray(kids.caseWhen) ? kids.caseWhen : []
    if (caseWhen.includes(expr)) return 'boolean'
    if (kids.caseElse === expr) return sanitizeType(parent.type) || undefined
    let caseThen: Expression[] = Array.isArray(kids.caseThen) ? kids.caseThen : []
    if (caseThen.includes(expr)) return sanitizeType(parent.type) || undefined
    if (kids.caseValue === expr) {
      let sample = caseThen[0]
      if (sample?.type) return sanitizeType(sample.type)
    }
  }

  return undefined
}

function getBinarySibling (parent: Expression, target: Expression): Expression | undefined {
  if (!(parent as any)?.kids) return undefined
  let kids = (parent as any).kids
  let left: Expression | undefined = kids.left
  let right: Expression | undefined = kids.right
  if (left === target) return right
  if (right === target) return left
  return undefined
}

const FIELD_TYPES = new Set<FieldType>(['string', 'number', 'boolean', 'date', 'timestamp', 'json', 'sql native', 'error', 'fieldref', 'array', 'record', 'null'])

function sanitizeType (value: unknown): FieldType | undefined {
  if (typeof value !== 'string') return undefined
  if (!FIELD_TYPES.has(value as FieldType)) return undefined
  if (value === 'fieldref') return undefined
  return value as FieldType
}

export function fillInParams (query: MalloyQuery, params: Record<string, any>) {
  let q = structuredClone(query)

  let filters = q.pipeline[0].filterList || []
  for (let filter of filters) {
    walkExpression(filter.e, e => {
      if (e.node !== 'parameter') return
      let value = params[e.path[0]]
      if (value === undefined) throw new Error(`Missing param $${e.path[0]}`)
      else if (e.type == 'string') Object.assign(e, {node: 'stringLiteral', literal: value})
      else if (e.type == 'number') Object.assign(e, {node: 'numberLiteral', literal: value.toString()})
      else if (e.type == 'boolean') Object.assign(e, {node: value ? 'true' : 'false'})
      else throw new Error(`Unsupported param type ${e.type}`)
    })
  }

  return q
}
