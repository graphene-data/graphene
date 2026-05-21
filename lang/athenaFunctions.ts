// Athena's DML/query dialect is based on Trino/Presto. Most of our generic
// function definitions are close enough to DuckDB for initial support; add
// Athena-specific overrides here as we find differences in real usage.

import type {FunctionDef} from './functionTypes.ts'

import {duckDbFunctions} from './duckDbFunctions.ts'

export const athenaFunctions: FunctionDef[] = duckDbFunctions
