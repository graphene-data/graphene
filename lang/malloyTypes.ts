// Some of the internal types Malloy's IR uses.

export type AtomicType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp'

export interface AtomicFieldDef {
  type: AtomicType
  name: string
  e?: Expression
}

export interface RefToField {
  type: 'fieldref'
  path: string[]
}

export interface JoinFieldDef extends TableSourceDef {
  join: 'one' | 'many'
  onExpression?: Expression
}

export type FieldDef = AtomicFieldDef | JoinFieldDef

export interface TableSourceDef {
  type: 'table'
  name: string
  fields?: FieldDef[]
  connection?: string
  dialect?: string
  tablePath?: string
}

export interface QuerySourceDef {
  type: 'query_source'
  name: string
  fields: AtomicFieldDef[]
  connection?: string
  dialect?: string
  query: Query
}

export type StructContent = TableSourceDef | QuerySourceDef

export interface ModelDef {
  name: string
  exports: string[]
  contents: Record<string, StructContent>
  queryList: Query[]
  dependencies: Record<string, unknown>
}

export type FilterExpression = {
  node: 'filterCondition'
  code: string
  expressionType: 'scalar'
  e: Expression
}

export type Expression =
  | {node: 'field'; path: string[]}
  | {node: 'numberLiteral'; literal: string}
  | {node: 'stringLiteral'; literal: string}
  | {node: 'aggregate'; function: string; e?: Expression}
  | {node: '/'; kids: {left: Expression; right: Expression}}
  | {node: '+' | '-' | '*' | '%'; kids: {left: Expression; right: Expression}}
  | {node: '=' | '!=' | '<>' | '<' | '>' | '<=' | '>='; kids: {left: Expression; right: Expression}}
  | {node: 'like'; kids: {left: Expression; right: Expression}}
  | {node: 'and' | 'or'; kids: {left: Expression; right: Expression}}
  | {node: 'not'; e: Expression}
  | {node: 'all'; e: Expression}

export interface ProjectStage {
  type: 'project'
  queryFields: (RefToField | AtomicFieldDef)[]
}

export interface ReduceStage {
  type: 'reduce'
  queryFields: (RefToField | AtomicFieldDef)[]
  filterList?: FilterExpression[]
}

export type PipelineStage = ProjectStage | ReduceStage

export interface Query {
  structRef: string
  pipeline: PipelineStage[]
}
