// BigQuery SQL function definitions
// These get converted to Malloy blueprints in functions.ts
//
// Documentation is copied verbatim from:
// https://cloud.google.com/bigquery/docs/reference/standard-sql/

import type {FunctionDef} from './functionTypes.ts'

import {inferGrain} from './temporalMetadata.ts'
import {trimIndentation} from './util.ts'

const bq = 'https://cloud.google.com/bigquery/docs/reference/standard-sql'

// Helper to trim and dedent multiline strings
const trim = trimIndentation

export const bigQueryFunctions: FunctionDef[] = [
  // ============================================================================
  // Window Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/window-functions
  // ============================================================================
  {
    name: 'row_number',
    description: trim('ROW_NUMBER() returns the sequential row number (1-based) of each row within a window.'),
    url: `${bq}/numbering_functions#row_number`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'rank',
    description: trim('RANK() returns the rank of each row within a window, with gaps for ties.'),
    url: `${bq}/numbering_functions#rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'dense_rank',
    description: trim('DENSE_RANK() returns the rank of each row within a window, without gaps.'),
    url: `${bq}/numbering_functions#dense_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'ntile',
    description: trim('NTILE(constant_integer_expression) returns the bucket number for each row in a window.'),
    url: `${bq}/numbering_functions#ntile`,
    args: [{name: 'constant_integer_expression', type: 'number'}],
    returns: 'number',
    window: true,
  },
  {
    name: 'lag',
    description: trim('LAG(value_expression, offset, default_expression) returns data from a previous row in a window.'),
    url: `${bq}/navigation_functions#lag`,
    args: [
      {name: 'value_expression', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default_expression', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'lead',
    description: trim('LEAD(value_expression, offset, default_expression) returns data from a following row in a window.'),
    url: `${bq}/navigation_functions#lead`,
    args: [
      {name: 'value_expression', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default_expression', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'first_value',
    description: trim('FIRST_VALUE(value_expression) returns the first value in the current window frame.'),
    url: `${bq}/navigation_functions#first_value`,
    args: [{name: 'value_expression', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'last_value',
    description: trim('LAST_VALUE(value_expression) returns the last value in the current window frame.'),
    url: `${bq}/navigation_functions#last_value`,
    args: [{name: 'value_expression', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'nth_value',
    description: trim('NTH_VALUE(value_expression, constant_integer_expression) returns the nth value in the frame.'),
    url: `${bq}/navigation_functions#nth_value`,
    args: [
      {name: 'value_expression', type: 'T'},
      {name: 'constant_integer_expression', type: 'number'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'percent_rank',
    description: trim('PERCENT_RANK() returns the percentile rank of each row in the partition.'),
    url: `${bq}/numbering_functions#percent_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'cume_dist',
    description: trim('CUME_DIST() returns the cumulative distribution value for each row in the partition.'),
    url: `${bq}/numbering_functions#cume_dist`,
    args: [],
    returns: 'number',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions
  // ============================================================================

  {
    name: 'any_value',
    description: trim(`
      ANY_VALUE(expression [HAVING {MAX | MIN} having_expression]) [OVER over_clause]

      Returns \`expression\` for some row chosen from the group. Which row is chosen is nondeterministic, not random. Returns \`NULL\` when the input produces no rows. Returns \`NULL\` when \`expression\` or \`having_expression\` is \`NULL\` for all rows in the group.

      If \`expression\` contains any non-NULL values, then \`ANY_VALUE\` behaves as if \`IGNORE NULLS\` is specified; rows for which \`expression\` is \`NULL\` aren't considered and won't be selected.

      If the \`HAVING\` clause is included in the \`ANY_VALUE\` function, the \`OVER\` clause can't be used with this function.

      Supported Argument Types: Any
      Returned Data Types: Matches the input data type.
    `),
    url: `${bq}/aggregate_functions#any_value`,
    args: [{name: 'expression', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'array_agg',
    description: trim(`
      ARRAY_AGG([DISTINCT] expression [{IGNORE | RESPECT} NULLS] [ORDER BY key [{ASC | DESC}] [, ...]] [LIMIT n]) [OVER over_clause]

      Returns an ARRAY of \`expression\` values.

      An error is raised if an array in the final query result contains a \`NULL\` element.

      Supported Argument Types: All data types except ARRAY.
      Returned Data Types: ARRAY. If there are zero input rows, this function returns \`NULL\`.
    `),
    url: `${bq}/aggregate_functions#array_agg`,
    args: [{name: 'expression', type: 'T', description: 'All data types except ARRAY.'}],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'array_concat_agg',
    description: trim(`
      ARRAY_CONCAT_AGG(expression [ORDER BY key [{ASC | DESC}] [, ...]] [LIMIT n])

      Concatenates elements from \`expression\` of type ARRAY, returning a single ARRAY as a result. This function ignores \`NULL\` input arrays, but respects the \`NULL\` elements in non-\`NULL\` input arrays. Returns \`NULL\` if there are zero input rows or \`expression\` evaluates to \`NULL\` for all rows.

      Supported Argument Types: ARRAY
      Returned Data Types: ARRAY
    `),
    url: `${bq}/aggregate_functions#array_concat_agg`,
    args: [{name: 'expression', type: 'array'}],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'avg',
    description: trim(`
      AVG([DISTINCT] expression) [OVER over_clause]

      Returns the average of non-\`NULL\` values in an aggregated group.

      Caveats:
      - If the aggregated group is empty or the argument is \`NULL\` for all rows in the group, returns \`NULL\`.
      - If the argument is \`NaN\` for any row in the group, returns \`NaN\`.
      - If the argument is \`[+|-]Infinity\` for any row in the group, returns either \`[+|-]Infinity\` or \`NaN\`.
      - If there is numeric overflow, produces an error.
      - If a floating-point type is returned, the result is non-deterministic, which means you might receive a different result each time you use this function.

      Supported Argument Types: Any numeric input type, INTERVAL
      Returned Data Types: FLOAT64 for INT64 inputs, NUMERIC for NUMERIC inputs, BIGNUMERIC for BIGNUMERIC inputs, FLOAT64 for FLOAT64 inputs, INTERVAL for INTERVAL inputs.
    `),
    url: `${bq}/aggregate_functions#avg`,
    args: [{name: 'expression', type: 'number', description: 'Any numeric input type or INTERVAL.'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_and',
    description: trim(`
      BIT_AND([DISTINCT] expression)

      Performs a bitwise AND operation on \`expression\` and returns the result.

      Supported Argument Types: INT64
      Returned Data Types: INT64
    `),
    url: `${bq}/aggregate_functions#bit_and`,
    args: [{name: 'expression', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_or',
    description: trim(`
      BIT_OR([DISTINCT] expression)

      Performs a bitwise OR operation on \`expression\` and returns the result.

      Supported Argument Types: INT64
      Returned Data Types: INT64
    `),
    url: `${bq}/aggregate_functions#bit_or`,
    args: [{name: 'expression', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_xor',
    description: trim(`
      BIT_XOR([DISTINCT] expression)

      Performs a bitwise XOR operation on \`expression\` and returns the result.

      Supported Argument Types: INT64
      Returned Data Types: INT64
    `),
    url: `${bq}/aggregate_functions#bit_xor`,
    args: [{name: 'expression', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'count',
    description: trim(`
      COUNT(*) [OVER over_clause]
      COUNT([DISTINCT] expression) [OVER over_clause]

      Returns the number of rows in the input, or the number of rows with an expression evaluated to any value other than \`NULL\`.

      Definitions:
      - \`*\`: Returns the number of all rows in the input.
      - \`expression\`: A value of any data type that represents the expression to evaluate. If \`DISTINCT\` is present, \`expression\` can only be a data type that is groupable.
      - \`DISTINCT\`: Each distinct value of \`expression\` is aggregated only once into the result.

      Details:
      To count the number of distinct values of an expression for which a certain condition is satisfied, you can use: COUNT(DISTINCT IF(condition, expression, NULL))

      Returned Data Types: INT64
    `),
    url: `${bq}/aggregate_functions#count`,
    args: [{name: 'expression', type: 'any?', description: 'A value of any data type. If DISTINCT is present, expression can only be a groupable data type.'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'countif',
    aliases: ['count_if'],
    description: trim(`
      COUNTIF([DISTINCT] expression) [OVER over_clause]

      Returns the count of \`TRUE\` values for \`expression\`. Returns \`0\` if there are zero input rows, or if \`expression\` evaluates to \`FALSE\` or \`NULL\` for all rows.

      Definitions:
      - \`expression\`: A \`BOOL\` value that represents the expression to evaluate.

      Details:
      The function signature \`COUNTIF(DISTINCT ...)\` is generally not useful. If you would like to use \`DISTINCT\`, use \`COUNT\` with \`DISTINCT IF\`.

      Returned Data Types: INT64
    `),
    url: `${bq}/aggregate_functions#countif`,
    args: [{name: 'expression', type: 'boolean', description: 'A BOOL value that represents the expression to evaluate.'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'logical_and',
    description: trim(`
      LOGICAL_AND(expression)

      Returns the logical AND of all non-\`NULL\` expressions. Returns \`NULL\` if there are zero input rows or \`expression\` evaluates to \`NULL\` for all rows.

      Supported Argument Types: BOOL
      Returned Data Types: BOOL
    `),
    url: `${bq}/aggregate_functions#logical_and`,
    args: [{name: 'expression', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'logical_or',
    description: trim(`
      LOGICAL_OR(expression)

      Returns the logical OR of all non-\`NULL\` expressions. Returns \`NULL\` if there are zero input rows or \`expression\` evaluates to \`NULL\` for all rows.

      Supported Argument Types: BOOL
      Returned Data Types: BOOL
    `),
    url: `${bq}/aggregate_functions#logical_or`,
    args: [{name: 'expression', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'max',
    description: trim(`
      MAX(expression) [OVER over_clause]

      Returns the maximum non-\`NULL\` value in an aggregated group.

      Caveats:
      - If the aggregated group is empty or the argument is \`NULL\` for all rows in the group, returns \`NULL\`.
      - If the argument is \`NaN\` for any row in the group, returns \`NaN\`.

      Supported Argument Types: Any orderable data type except for ARRAY.
      Returned Data Types: The data type of the input values.
    `),
    url: `${bq}/aggregate_functions#max`,
    args: [{name: 'expression', type: 'T', description: 'Any orderable data type except for ARRAY.'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'max_by',
    description: trim(`
      MAX_BY(x, y)

      Returns the value of \`x\` associated with the maximum value of \`y\` in an aggregated group.

      Definitions:
      - \`x\`: The value to return.
      - \`y\`: The value used to determine the maximum.

      Caveats:
      - If the aggregated group is empty, returns \`NULL\`.
      - If the maximum value of \`y\` is \`NULL\`, returns the corresponding value of \`x\`.

      Supported Argument Types: \`x\` can be any type. \`y\` must be an orderable data type.
      Returned Data Types: The type of \`x\`.
    `),
    url: `${bq}/aggregate_functions#max_by`,
    args: [
      {name: 'x', type: 'T', description: 'The value to return.'},
      {name: 'y', type: 'any', description: 'The value used to determine the maximum. Must be an orderable data type.'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'min',
    description: trim(`
      MIN(expression) [OVER over_clause]

      Returns the minimum non-\`NULL\` value in an aggregated group.

      Caveats:
      - If the aggregated group is empty or the argument is \`NULL\` for all rows in the group, returns \`NULL\`.
      - If the argument is \`NaN\` for any row in the group, returns \`NaN\`.

      Supported Argument Types: Any orderable data type except for ARRAY.
      Returned Data Types: The data type of the input values.
    `),
    url: `${bq}/aggregate_functions#min`,
    args: [{name: 'expression', type: 'T', description: 'Any orderable data type except for ARRAY.'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'min_by',
    description: trim(`
      MIN_BY(x, y)

      Returns the value of \`x\` associated with the minimum value of \`y\` in an aggregated group.

      Definitions:
      - \`x\`: The value to return.
      - \`y\`: The value used to determine the minimum.

      Caveats:
      - If the aggregated group is empty, returns \`NULL\`.
      - If the minimum value of \`y\` is \`NULL\`, returns the corresponding value of \`x\`.

      Supported Argument Types: \`x\` can be any type. \`y\` must be an orderable data type.
      Returned Data Types: The type of \`x\`.
    `),
    url: `${bq}/aggregate_functions#min_by`,
    args: [
      {name: 'x', type: 'T', description: 'The value to return.'},
      {name: 'y', type: 'any', description: 'The value used to determine the minimum. Must be an orderable data type.'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'string_agg',
    description: trim(`
      STRING_AGG([DISTINCT] expression [, delimiter] [ORDER BY key [{ASC | DESC}] [, ...]] [LIMIT n]) [OVER over_clause]

      Returns a value (either STRING or BYTES) obtained by concatenating non-\`NULL\` values. Returns \`NULL\` if there are zero input rows or \`expression\` evaluates to \`NULL\` for all rows.

      If a \`delimiter\` is specified, concatenated values are separated by that delimiter; otherwise, a comma is used as a delimiter.

      Supported Argument Types: Either STRING or BYTES.
      Returned Data Types: Either STRING or BYTES.
    `),
    url: `${bq}/aggregate_functions#string_agg`,
    args: [
      {name: 'expression', type: 'string', description: 'Either STRING or BYTES.'},
      {name: 'delimiter', type: 'string?', description: 'The delimiter to use. Defaults to comma.'},
    ],
    returns: 'string',
    aggregate: true,
  },
  {
    name: 'sum',
    description: trim(`
      SUM([DISTINCT] expression) [OVER over_clause]

      Returns the sum of non-\`NULL\` values in an aggregated group.

      Caveats:
      - If the aggregated group is empty or the argument is \`NULL\` for all rows in the group, returns \`NULL\`.
      - If the argument is \`NaN\` for any row in the group, returns \`NaN\`.
      - If the argument is \`[+|-]Infinity\` for any row in the group, returns either \`[+|-]Infinity\` or \`NaN\`.
      - If there is numeric overflow, produces an error.
      - If a floating-point type is returned, the result is non-deterministic, which means you might receive a different result each time you use this function.

      Supported Argument Types: Any supported numeric data type, INTERVAL
      Returned Data Types: INT64 for INT64 inputs, NUMERIC for NUMERIC inputs, BIGNUMERIC for BIGNUMERIC inputs, FLOAT64 for FLOAT64 inputs, INTERVAL for INTERVAL inputs.
    `),
    url: `${bq}/aggregate_functions#sum`,
    args: [{name: 'expression', type: 'number', description: 'Any supported numeric data type or INTERVAL.'}],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Mathematical Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions
  // ============================================================================

  {
    name: 'abs',
    description: trim(`
      ABS(X)

      Computes the absolute value. Returns an error if the argument is an integer and the output value cannot be represented as the same type; this happens only for the largest negative input value, which has no positive representation.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same type as input
    `),
    url: `${bq}/mathematical_functions#abs`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acos',
    description: trim(`
      ACOS(X)

      Computes the principal value of the inverse cosine of X. The return value is in the range [0,π]. Generates an error if X is a value outside of the range [-1, 1].

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#acos`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acosh',
    description: trim(`
      ACOSH(X)

      Computes the inverse hyperbolic cosine of X. Generates an error if X is a value less than 1.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#acosh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asin',
    description: trim(`
      ASIN(X)

      Computes the principal value of the inverse sine of X. The return value is in the range [-π/2,π/2]. Generates an error if X is outside of the range [-1, 1].

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#asin`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asinh',
    description: trim(`
      ASINH(X)

      Computes the inverse hyperbolic sine of X. Does not fail.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#asinh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan',
    description: trim(`
      ATAN(X)

      Computes the principal value of the inverse tangent of X. The return value is in the range [-π/2,π/2]. Does not fail.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#atan`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan2',
    description: trim(`
      ATAN2(X, Y)

      Calculates the principal value of the inverse tangent of X/Y using the signs of the two arguments to determine the quadrant. The return value is in the range [-π,π].

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#atan2`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'atanh',
    description: trim(`
      ATANH(X)

      Computes the inverse hyperbolic tangent of X. Generates an error if X is outside of the range (-1, 1).

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#atanh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cbrt',
    description: trim(`
      CBRT(X)

      Computes the cube root of X. X can be any data type that coerces to FLOAT64. This function does not fail.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#cbrt`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ceil',
    description: trim(`
      CEIL(X)

      Returns the smallest integral value that is not less than X.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#ceil`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ceiling',
    description: trim(`
      CEILING(X)

      Synonym of CEIL(X).

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#ceiling`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cos',
    description: trim(`
      COS(X)

      Computes the cosine of X where X is specified in radians. Never fails.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#cos`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cosh',
    description: trim(`
      COSH(X)

      Computes the hyperbolic cosine of X where X is specified in radians. Generates an error if overflow occurs.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#cosh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cot',
    description: trim(`
      COT(X)

      Computes the cotangent of X where X is specified in radians. Generates an error if X is 0.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#cot`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'coth',
    description: trim(`
      COTH(X)

      Computes the hyperbolic cotangent of X where X is specified in radians. Generates an error if X is 0.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#coth`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'csc',
    description: trim(`
      CSC(X)

      Computes the cosecant of X where X is specified in radians. Generates an error if X is 0.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#csc`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'csch',
    description: trim(`
      CSCH(X)

      Computes the hyperbolic cosecant of X where X is specified in radians. Generates an error if X is 0.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#csch`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'div',
    description: trim(`
      DIV(X, Y)

      Returns the result of integer division of X by Y. Division by zero returns an error. Division by -1 may overflow.

      Supported Argument Types: X and Y must both be integer types.
      Returned Data Types: The larger of the two argument types.
    `),
    url: `${bq}/mathematical_functions#div`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'exp',
    description: trim(`
      EXP(X)

      Computes e to the power of X, also called the natural exponential function. If the result underflows, this function returns a zero. Generates an error if the result overflows.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#exp`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'floor',
    description: trim(`
      FLOOR(X)

      Returns the largest integral value that is not greater than X.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#floor`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'greatest',
    description: trim(`
      GREATEST(X1,...,XN)

      Returns the greatest value among X1,...,XN. If any argument is NULL, returns NULL. Otherwise, in the case of floating-point arguments, if any argument is NaN, returns NaN. In all other cases, returns the value among X1,...,XN that has the greatest value according to the ordering used by the ORDER BY clause.

      Supported Argument Types: Any type
      Returned Data Types: The supertype of the input types.
    `),
    url: `${bq}/mathematical_functions#greatest`,
    args: [['values', 'T...']],
    returns: 'T',
  },
  {
    name: 'is_inf',
    description: trim(`
      IS_INF(X)

      Returns TRUE if the value is positive or negative infinity.

      Supported Argument Types: FLOAT64
      Returned Data Types: BOOL
    `),
    url: `${bq}/mathematical_functions#is_inf`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'is_nan',
    description: trim(`
      IS_NAN(X)

      Returns TRUE if the value is a NaN value.

      Supported Argument Types: FLOAT64
      Returned Data Types: BOOL
    `),
    url: `${bq}/mathematical_functions#is_nan`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'least',
    description: trim(`
      LEAST(X1,...,XN)

      Returns the least value among X1,...,XN. If any argument is NULL, returns NULL. Otherwise, in the case of floating-point arguments, if any argument is NaN, returns NaN. In all other cases, returns the value among X1,...,XN that has the least value according to the ordering used by the ORDER BY clause.

      Supported Argument Types: Any type
      Returned Data Types: The supertype of the input types.
    `),
    url: `${bq}/mathematical_functions#least`,
    args: [['values', 'T...']],
    returns: 'T',
  },
  {
    name: 'ln',
    description: trim(`
      LN(X)

      Computes the natural logarithm of X. Generates an error if X is less than or equal to zero.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#ln`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'log',
    description: trim(`
      LOG(X [, Y])

      If only X is present, LOG is a synonym of LN. If Y is also present, LOG computes the logarithm of X to base Y. Generates an error in these cases: X is less than or equal to zero; Y is 1.0; Y is less than or equal to zero.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#log`,
    args: [
      ['x', 'number'],
      ['y', 'number?'],
    ],
    returns: 'number',
  },
  {
    name: 'log10',
    description: trim(`
      LOG10(X)

      Similar to LOG, but computes logarithm to base 10.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#log10`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'mod',
    description: trim(`
      MOD(X, Y)

      Modulo function: returns the remainder of the division of X by Y. Returned value has the same sign as X. An error is generated if Y is 0.

      Supported Argument Types: X and Y must both be integer types, or both arguments must be NUMERIC, or both arguments must be BIGNUMERIC.
      Returned Data Types: The larger of the two argument types.
    `),
    url: `${bq}/mathematical_functions#mod`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'pow',
    description: trim(`
      POW(X, Y)

      Returns the value of X raised to the power of Y. If the result underflows and is not representable, then the function returns a value of zero.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#pow`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'power',
    description: trim(`
      POWER(X, Y)

      Synonym of POW(X, Y).

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#power`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'rand',
    description: trim(`
      RAND()

      Generates a pseudo-random value of type FLOAT64 in the range of [0, 1), inclusive of 0 and exclusive of 1.

      Supported Argument Types: None
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#rand`,
    args: [],
    returns: 'number',
  },
  {
    name: 'round',
    description: trim(`
      ROUND(X [, N])

      If only X is present, rounds X to the nearest integer. If N is present, rounds X to N decimal places after the decimal point. If N is negative, rounds off digits to the left of the decimal point. Rounds halfway cases away from zero. Generates an error if overflow occurs.

      Supported Argument Types: X can be any numeric type. N must be INT64.
      Returned Data Types: If X is FLOAT64, returns FLOAT64. Otherwise returns NUMERIC or BIGNUMERIC.
    `),
    url: `${bq}/mathematical_functions#round`,
    args: [
      ['x', 'number'],
      ['n', 'number?'],
    ],
    returns: 'number',
  },
  {
    name: 'safe_add',
    description: trim(`
      SAFE_ADD(X, Y)

      Equivalent to the addition operator (+), but returns NULL if overflow occurs.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same as input types
    `),
    url: `${bq}/mathematical_functions#safe_add`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'safe_divide',
    description: trim(`
      SAFE_DIVIDE(X, Y)

      Equivalent to the division operator (/), but returns NULL if an error occurs, such as a division by zero error.

      Supported Argument Types: Any numeric type
      Returned Data Types: FLOAT64 for integer inputs, or same as input for other types.
    `),
    url: `${bq}/mathematical_functions#safe_divide`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'safe_multiply',
    description: trim(`
      SAFE_MULTIPLY(X, Y)

      Equivalent to the multiplication operator (*), but returns NULL if overflow occurs.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same as input types
    `),
    url: `${bq}/mathematical_functions#safe_multiply`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'safe_negate',
    description: trim(`
      SAFE_NEGATE(X)

      Equivalent to the unary minus operator (-), but returns NULL if overflow occurs.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same as input type
    `),
    url: `${bq}/mathematical_functions#safe_negate`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'safe_subtract',
    description: trim(`
      SAFE_SUBTRACT(X, Y)

      Equivalent to the subtraction operator (-), but returns NULL if overflow occurs.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same as input types
    `),
    url: `${bq}/mathematical_functions#safe_subtract`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'sec',
    description: trim(`
      SEC(X)

      Computes the secant of X where X is specified in radians. Never fails.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#sec`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sech',
    description: trim(`
      SECH(X)

      Computes the hyperbolic secant of X where X is specified in radians. Never fails.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#sech`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sign',
    description: trim(`
      SIGN(X)

      Returns -1, 0, or +1 for negative, zero and positive arguments respectively. For floating point arguments, this function does not distinguish between positive and negative zero.

      Supported Argument Types: Any numeric type
      Returned Data Types: Same as input type
    `),
    url: `${bq}/mathematical_functions#sign`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sin',
    description: trim(`
      SIN(X)

      Computes the sine of X where X is specified in radians. Never fails.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#sin`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sinh',
    description: trim(`
      SINH(X)

      Computes the hyperbolic sine of X where X is specified in radians. Generates an error if overflow occurs.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#sinh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sqrt',
    description: trim(`
      SQRT(X)

      Computes the square root of X. Generates an error if X is less than 0.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#sqrt`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'tan',
    description: trim(`
      TAN(X)

      Computes the tangent of X where X is specified in radians. Generates an error if overflow occurs.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#tan`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'tanh',
    description: trim(`
      TANH(X)

      Computes the hyperbolic tangent of X where X is specified in radians. Does not fail.

      Supported Argument Types: FLOAT64
      Returned Data Types: FLOAT64
    `),
    url: `${bq}/mathematical_functions#tanh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'trunc',
    description: trim(`
      TRUNC(X [, N])

      If only X is present, TRUNC rounds X to the nearest integer whose absolute value is not greater than the absolute value of X. If N is also present, TRUNC behaves like ROUND(X, N), but always rounds towards zero and never overflows.

      Supported Argument Types: X can be any numeric type. N must be INT64.
      Returned Data Types: If X is FLOAT64, returns FLOAT64. Otherwise returns NUMERIC or BIGNUMERIC.
    `),
    url: `${bq}/mathematical_functions#trunc`,
    args: [
      ['x', 'number'],
      ['n', 'number?'],
    ],
    returns: 'number',
  },

  // ============================================================================
  // String Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions
  // ============================================================================

  {
    name: 'ascii',
    description: trim(`
      ASCII(value)

      Returns the ASCII code for the first character or byte of value. Returns 0 if value is empty or the ASCII code is 0 for the first character or byte.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#ascii`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'byte_length',
    description: trim(`
      BYTE_LENGTH(value)

      Gets the number of BYTES in a STRING or BYTES value, regardless of whether the value is a STRING or BYTES type.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#byte_length`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'char_length',
    description: trim(`
      CHAR_LENGTH(value)

      Gets the number of characters in a STRING value.

      Supported Argument Types: STRING
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#char_length`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'character_length',
    description: trim(`
      CHARACTER_LENGTH(value)

      Synonym for CHAR_LENGTH.

      Supported Argument Types: STRING
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#character_length`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'chr',
    description: trim(`
      CHR(value)

      Takes a Unicode code point and returns the character that matches the code point. Each valid code point should fall within the range of [0, 0xD7FF] and [0xE000, 0x10FFFF]. Returns an empty string if the code point is 0. If an invalid Unicode code point is specified, an error is returned.

      Supported Argument Types: INT64
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#chr`,
    args: [['value', 'number']],
    returns: 'string',
  },
  {
    name: 'concat',
    description: trim(`
      CONCAT(value1[, ...])

      Concatenates one or more values into a single result. All values must be BYTES or data types that can be cast to STRING. The function returns NULL if any input argument is NULL.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#concat`,
    args: [['values', 'string...']],
    returns: 'string',
  },
  {
    name: 'contains_substr',
    description: trim(`
      CONTAINS_SUBSTR(expression, search_value_literal[, json_scope=>json_scope_value])

      Performs a normalized, case-insensitive search to see if a value exists as a substring in an expression. Returns TRUE if the value exists, otherwise returns FALSE.

      Before values are compared, they are normalized and case folded with NFKC normalization. Wildcard searches are not supported.

      Definitions:
      - search_value_literal: The value to search for. It must be a STRING literal or a STRING constant expression.
      - expression: The data to search over. The expression can be a column or table reference. A table reference is evaluated as a STRUCT whose fields are the columns of the table. When the expression is evaluated, the result is cast to a STRING, and then the function looks for the search value in the result.
      - json_scope: A named argument with a STRING value. Takes 'JSON_VALUES' (default), 'JSON_KEYS', or 'JSON_KEYS_AND_VALUES' to indicate the scope of JSON data to be searched.

      Returned Data Types: BOOL
    `),
    url: `${bq}/string_functions#contains_substr`,
    args: [
      {name: 'expression', type: 'any', description: 'The data to search over. The expression can be a column or table reference.'},
      {name: 'search_value_literal', type: 'string', description: 'The value to search for. It must be a STRING literal or a STRING constant expression.'},
      {
        name: 'json_scope',
        type: 'string?',
        description: "A named argument with a STRING value. Takes 'JSON_VALUES' (default), 'JSON_KEYS', or 'JSON_KEYS_AND_VALUES' to indicate the scope of JSON data to be searched.",
      },
    ],
    returns: 'boolean',
  },
  {
    name: 'ends_with',
    description: trim(`
      ENDS_WITH(value, suffix)

      Takes two STRING or BYTES values. Returns TRUE if suffix is a suffix of value.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: BOOL
    `),
    url: `${bq}/string_functions#ends_with`,
    args: [
      ['value', 'string'],
      ['suffix', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'format',
    description: trim(`
      FORMAT(format_string_expression, data_type_expression[, ...])

      Formats a data type expression as a string. All expressions are supported except for ARRAY, STRUCT, and GEOGRAPHY.

      Supported Argument Types: format_string_expression must be STRING. data_type_expression can be any type except ARRAY, STRUCT, GEOGRAPHY.
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#format`,
    args: [
      ['format_string', 'string'],
      ['values', 'any...'],
    ],
    returns: 'string',
  },
  {
    name: 'initcap',
    description: trim(`
      INITCAP(value[, delimiters])

      Takes a STRING value and returns it with the first character in each word in uppercase and all other characters in lowercase. Non-alphabetic characters remain the same.

      Definitions:
      - value: The STRING value to format.
      - delimiters: A STRING value containing the characters that define word boundaries. Defaults to space.

      Supported Argument Types: STRING
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#initcap`,
    args: [
      {name: 'value', type: 'string', description: 'The STRING value to format.'},
      {name: 'delimiters', type: 'string?', description: 'A STRING value containing the characters that define word boundaries. Defaults to space.'},
    ],
    returns: 'string',
  },
  {
    name: 'instr',
    description: trim(`
      INSTR(value, subvalue[, position[, occurrence]])

      Returns the 1-based position of the first occurrence of subvalue inside value, starting from position and optionally searching for the nth occurrence. Returns 0 if no match is found.

      Definitions:
      - value: The value to search within.
      - subvalue: The value to search for.
      - position: The 1-based position to start searching from. Negative searches backward from the end. Defaults to 1.
      - occurrence: Which occurrence to find. Defaults to 1.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#instr`,
    args: [
      {name: 'value', type: 'string', description: 'The value to search within.'},
      {name: 'subvalue', type: 'string', description: 'The value to search for.'},
      {name: 'position', type: 'number?', description: 'The 1-based position to start searching from. Negative searches backward from the end. Defaults to 1.'},
      {name: 'occurrence', type: 'number?', description: 'Which occurrence to find. Defaults to 1.'},
    ],
    returns: 'number',
  },
  {
    name: 'left',
    description: trim(`
      LEFT(value, length)

      Returns a STRING or BYTES value that consists of the specified number of leftmost characters or bytes from value. If length is 0 or negative, an empty STRING or BYTES value is returned. If length is greater than the length of value, the original value is returned.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#left`,
    args: [
      ['value', 'string'],
      ['length', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'length',
    description: trim(`
      LENGTH(value)

      Returns the length of the STRING or BYTES value. The returned value is in characters for STRING arguments and in bytes for the BYTES argument.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#length`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'lower',
    description: trim(`
      LOWER(value)

      Returns the original string with all alphabetic characters in lowercase. Mapping between lowercase and uppercase is done according to the Unicode Character Database without taking into account language-specific mappings.

      Supported Argument Types: STRING
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#lower`,
    args: [['value', 'string']],
    returns: 'string',
  },
  {
    name: 'lpad',
    description: trim(`
      LPAD(original_value, return_length[, pattern])

      Returns a STRING or BYTES value that consists of original_value prepended with pattern. The returned value has length return_length. If original_value exceeds return_length, this function truncates original_value to return_length.

      Definitions:
      - original_value: The value to pad.
      - return_length: The length of the returned value.
      - pattern: The pattern to use for padding. Defaults to a single space.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#lpad`,
    args: [
      {name: 'original_value', type: 'string', description: 'The value to pad.'},
      {name: 'return_length', type: 'number', description: 'The length of the returned value.'},
      {name: 'pattern', type: 'string?', description: 'The pattern to use for padding. Defaults to a single space.'},
    ],
    returns: 'string',
  },
  {
    name: 'ltrim',
    description: trim(`
      LTRIM(value1[, value2])

      Returns a STRING or BYTES value that is the same as value1, but with all leading characters that appear in value2 removed. If value2 is not specified, all leading whitespace characters are removed.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#ltrim`,
    args: [
      {name: 'value', type: 'string'},
      {name: 'characters', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'regexp_contains',
    description: trim(`
      REGEXP_CONTAINS(value, regexp)

      Returns TRUE if value is a partial match for the regular expression, regexp.

      If the regexp argument is invalid, the function returns an error.

      Supported Argument Types: STRING
      Returned Data Types: BOOL
    `),
    url: `${bq}/string_functions#regexp_contains`,
    args: [
      ['value', 'string'],
      ['regexp', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'regexp_extract',
    description: trim(`
      REGEXP_EXTRACT(value, regexp[, position[, occurrence]])

      Returns the first substring in value that matches the regular expression, regexp. Returns NULL if there is no match.

      If the regular expression contains a capturing group, the function returns the substring that is matched by that capturing group. If the expression does not contain a capturing group, the function returns the entire matching substring.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#regexp_extract`,
    args: [
      {name: 'value', type: 'string'},
      {name: 'regexp', type: 'string'},
      {name: 'position', type: 'number?'},
      {name: 'occurrence', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'regexp_extract_all',
    description: trim(`
      REGEXP_EXTRACT_ALL(value, regexp)

      Returns an array of all substrings of value that match the regular expression, regexp.

      Supported Argument Types: STRING
      Returned Data Types: ARRAY<STRING>
    `),
    url: `${bq}/string_functions#regexp_extract_all`,
    args: [
      ['value', 'string'],
      ['regexp', 'string'],
    ],
    returns: 'array',
  },
  {
    name: 'regexp_instr',
    description: trim(`
      REGEXP_INSTR(source_value, regexp[, position[, occurrence[, occurrence_position]]])

      Returns the 1-based position of the first occurrence of the regular expression, regexp, in source_value. Returns 0 if no match is found.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#regexp_instr`,
    args: [
      {name: 'source_value', type: 'string'},
      {name: 'regexp', type: 'string'},
      {name: 'position', type: 'number?'},
      {name: 'occurrence', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'regexp_replace',
    description: trim(`
      REGEXP_REPLACE(value, regexp, replacement)

      Returns a STRING where all substrings of value that match the regular expression regexp are replaced with replacement.

      You can use backslash-escaped digits (\\1 to \\9) within the replacement string to insert text matching the corresponding parenthesized group in the regexp pattern.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#regexp_replace`,
    args: [
      ['value', 'string'],
      ['regexp', 'string'],
      ['replacement', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'repeat',
    description: trim(`
      REPEAT(original_value, repetitions)

      Returns a STRING or BYTES value that consists of original_value, repeated. The repetitions parameter specifies the number of times to repeat original_value.

      Returns NULL if any input is NULL. Returns an error if repetitions is negative.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#repeat`,
    args: [
      ['original_value', 'string'],
      ['repetitions', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'replace',
    description: trim(`
      REPLACE(original_value, from_expression, to_expression)

      Replaces all occurrences of from_expression in original_value with to_expression. Returns NULL if any input is NULL.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#replace`,
    args: [
      ['original_value', 'string'],
      ['from_expression', 'string'],
      ['to_expression', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'reverse',
    description: trim(`
      REVERSE(value)

      Returns the reverse of the input STRING or BYTES.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#reverse`,
    args: [['value', 'string']],
    returns: 'string',
  },
  {
    name: 'right',
    description: trim(`
      RIGHT(value, length)

      Returns a STRING or BYTES value that consists of the specified number of rightmost characters or bytes from value. If length is 0 or negative, an empty STRING or BYTES value is returned. If length is greater than the length of value, the original value is returned.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#right`,
    args: [
      ['value', 'string'],
      ['length', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'rpad',
    description: trim(`
      RPAD(original_value, return_length[, pattern])

      Returns a STRING or BYTES value that consists of original_value appended with pattern. The returned value has length return_length. If original_value exceeds return_length, this function truncates original_value to return_length.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#rpad`,
    args: [
      {name: 'original_value', type: 'string'},
      {name: 'return_length', type: 'number'},
      {name: 'pattern', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'rtrim',
    description: trim(`
      RTRIM(value1[, value2])

      Returns a STRING or BYTES value that is the same as value1, but with all trailing characters that appear in value2 removed. If value2 is not specified, all trailing whitespace characters are removed.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#rtrim`,
    args: [
      ['value', 'string'],
      ['characters', 'string?'],
    ],
    returns: 'string',
  },
  {
    name: 'soundex',
    description: trim(`
      SOUNDEX(value)

      Returns a STRING that represents the Soundex code for value.

      Supported Argument Types: STRING
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#soundex`,
    args: [['value', 'string']],
    returns: 'string',
  },
  {
    name: 'split',
    description: trim(`
      SPLIT(value[, delimiter])

      Splits value using the delimiter argument. Returns an ARRAY of STRING or BYTES.

      If value is STRING, the default delimiter is a comma. If value is BYTES, you must specify a delimiter.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: ARRAY<STRING> or ARRAY<BYTES>
    `),
    url: `${bq}/string_functions#split`,
    args: [
      {name: 'value', type: 'string', description: 'The STRING or BYTES value to split.'},
      {name: 'delimiter', type: 'string?', description: 'The delimiter to split on. Defaults to comma for STRING.'},
    ],
    returns: 'array',
  },
  {
    name: 'starts_with',
    description: trim(`
      STARTS_WITH(value, prefix)

      Takes two STRING or BYTES values. Returns TRUE if prefix is a prefix of value.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: BOOL
    `),
    url: `${bq}/string_functions#starts_with`,
    args: [
      ['value', 'string'],
      ['prefix', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'strpos',
    description: trim(`
      STRPOS(value, subvalue)

      Returns the 1-based position of the first occurrence of subvalue inside value. Returns 0 if subvalue is not found.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#strpos`,
    args: [
      ['value', 'string'],
      ['subvalue', 'string'],
    ],
    returns: 'number',
  },
  {
    name: 'substr',
    description: trim(`
      SUBSTR(value, position[, length])

      Gets a portion of a STRING or BYTES value, starting from the specified position. If length is specified, gets that many characters or bytes; otherwise gets all remaining.

      If position is negative, the function counts from the end of value, with -1 indicating the last character.

      If position is 0, the function starts from position 1.

      If length is specified and less than 0, the function returns an empty value.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#substr`,
    args: [
      {name: 'value', type: 'string'},
      {name: 'position', type: 'number', description: 'The 1-based starting position. Negative values count from the end.'},
      {name: 'length', type: 'number?', description: 'The number of characters or bytes to return.'},
    ],
    returns: 'string',
  },
  {
    name: 'substring',
    description: trim(`
      SUBSTRING(value, position[, length])

      Alias for SUBSTR.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#substring`,
    args: [
      ['value', 'string'],
      ['position', 'number'],
      ['length', 'number?'],
    ],
    returns: 'string',
  },
  {
    name: 'trim',
    description: trim(`
      TRIM(value[, cutset])

      Returns a STRING or BYTES value that is the same as value, but with all leading and trailing characters that appear in cutset removed. If cutset is not specified, all leading and trailing whitespace characters are removed.

      Supported Argument Types: STRING or BYTES
      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/string_functions#trim`,
    args: [
      ['value', 'string'],
      ['cutset', 'string?'],
    ],
    returns: 'string',
  },
  {
    name: 'unicode',
    description: trim(`
      UNICODE(value)

      Returns the Unicode code point for the first character in value. Returns 0 if value is empty, or if the resulting Unicode code point is 0.

      Supported Argument Types: STRING
      Returned Data Types: INT64
    `),
    url: `${bq}/string_functions#unicode`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'upper',
    description: trim(`
      UPPER(value)

      Returns the original string with all alphabetic characters in uppercase. Mapping between lowercase and uppercase is done according to the Unicode Character Database without taking into account language-specific mappings.

      Supported Argument Types: STRING
      Returned Data Types: STRING
    `),
    url: `${bq}/string_functions#upper`,
    args: [['value', 'string']],
    returns: 'string',
  },

  // ============================================================================
  // Conditional Expressions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions
  // ============================================================================

  {
    name: 'coalesce',
    description: trim(`
      COALESCE(expr[, ...])

      Returns the value of the first non-NULL expression. The remaining expressions are not evaluated. An input expression can be any type. There may be multiple input expression types. All input expressions must be implicitly coercible to a common supertype.

      Returned Data Types: Supertype of the input types.
    `),
    url: `${bq}/conditional_expressions#coalesce`,
    args: [['values', 'T...']],
    returns: 'T',
  },
  {
    name: 'if',
    description: trim(`
      IF(expr, true_result, else_result)

      If expr is TRUE, returns true_result, else returns the result of else_result. else_result is not evaluated if expr is TRUE. true_result is not evaluated if expr is FALSE or NULL.

      expr must be a BOOL. true_result and else_result must be coercible to a common supertype.

      Returned Data Types: Supertype of true_result and else_result.
    `),
    url: `${bq}/conditional_expressions#if`,
    args: [
      ['condition', 'boolean'],
      ['true_value', 'T'],
      ['false_value', 'T'],
    ],
    returns: 'T',
  },
  {
    name: 'ifnull',
    description: trim(`
      IFNULL(expr, null_result)

      If expr is NULL, returns null_result. Otherwise, returns expr. If expr is not NULL, null_result is not evaluated.

      expr and null_result can be any type and must be implicitly coercible to a common supertype. Synonym for COALESCE(expr, null_result).

      Returned Data Types: Supertype of expr and null_result.
    `),
    url: `${bq}/conditional_expressions#ifnull`,
    args: [
      ['value', 'T'],
      ['default_value', 'T'],
    ],
    returns: 'T',
  },
  {
    name: 'nullif',
    description: trim(`
      NULLIF(expr1, expr2)

      Returns NULL if expr1 = expr2 is TRUE, otherwise returns expr1.

      expr1 and expr2 must be implicitly coercible to a common supertype, and must be comparable.

      Returned Data Types: Supertype of expr1 and expr2.
    `),
    url: `${bq}/conditional_expressions#nullif`,
    args: [
      ['value1', 'T'],
      ['value2', 'T'],
    ],
    returns: 'T',
  },

  // ============================================================================
  // Date Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions
  // ============================================================================

  {
    name: 'current_date',
    description: trim(`
      CURRENT_DATE([time_zone])

      Returns the current date as a DATE value. Parentheses are optional when called with no arguments.

      This function supports an optional time_zone parameter. If no time zone is specified, the default time zone, UTC, is used.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#current_date`,
    args: [{name: 'time_zone', type: 'string?', description: 'The time zone to use. Defaults to UTC.'}],
    returns: 'date',
    supportsBareInvocation: true,
  },
  {
    name: 'date',
    description: trim(`
      DATE(year, month, day)
      DATE(timestamp_expression[, time_zone])
      DATE(datetime_expression)

      Constructs a DATE from INT64 values representing the year, month, and day. Extracts the DATE from a TIMESTAMP or DATETIME expression.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#date`,
    args: [
      {name: 'year_or_timestamp', type: 'any', description: 'Year as INT64, or a TIMESTAMP/DATETIME expression.'},
      {name: 'month_or_timezone', type: 'any?', description: 'Month as INT64, or time zone for TIMESTAMP.'},
      {name: 'day', type: 'number?', description: 'Day as INT64.'},
    ],
    returns: 'date',
  },
  {
    name: 'date_add',
    description: trim(`
      DATE_ADD(date_expression, INTERVAL int64_expression date_part)

      Adds a specified time interval to a DATE.

      DATE_ADD supports the following date_part values: DAY, WEEK, MONTH, QUARTER, YEAR.

      Special handling is required for MONTH, QUARTER, and YEAR parts when the date is at (or near) the last day of the month.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#date_add`,
    args: [
      {name: 'date_expression', type: 'date'},
      {name: 'interval', type: 'number', description: 'The interval value to add.'},
    ],
    returns: 'date',
  },
  {
    name: 'date_diff',
    description: trim(`
      DATE_DIFF(date_expression_a, date_expression_b, date_part)

      Returns the whole number of specified date_part intervals between two DATE values. The first DATE is the later value, the second is the earlier.

      DATE_DIFF supports the following date_part values: DAY, WEEK, WEEK(<WEEKDAY>), ISOWEEK, MONTH, QUARTER, YEAR, ISOYEAR.

      Returned Data Types: INT64
    `),
    url: `${bq}/date_functions#date_diff`,
    args: [
      {name: 'date_a', type: 'date', description: 'The later date.'},
      {name: 'date_b', type: 'date', description: 'The earlier date.'},
      {name: 'date_part', type: 'string', description: 'The date part to use for the difference.'},
    ],
    returns: 'number',
  },
  {
    name: 'date_from_unix_date',
    description: trim(`
      DATE_FROM_UNIX_DATE(int64_expression)

      Interprets int64_expression as the number of days since 1970-01-01.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#date_from_unix_date`,
    args: [['unix_date', 'number']],
    returns: 'date',
  },
  {
    name: 'date_sub',
    description: trim(`
      DATE_SUB(date_expression, INTERVAL int64_expression date_part)

      Subtracts a specified time interval from a DATE.

      DATE_SUB supports the following date_part values: DAY, WEEK, MONTH, QUARTER, YEAR.

      Special handling is required for MONTH, QUARTER, and YEAR parts when the date is at (or near) the last day of the month.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#date_sub`,
    args: [
      {name: 'date_expression', type: 'date'},
      {name: 'interval', type: 'number', description: 'The interval value to subtract.'},
    ],
    returns: 'date',
  },
  {
    name: 'date_trunc',
    description: trim(`
      DATE_TRUNC(date_expression, date_part)

      Truncates a DATE or TIMESTAMP value to the granularity of date_part. The value is always rounded to the beginning of date_part.

      DATE_TRUNC supports the following values for date_part: DAY, WEEK, WEEK(<WEEKDAY>), ISOWEEK, MONTH, QUARTER, YEAR, ISOYEAR.

      Returned Data Types: Same as input (DATE or TIMESTAMP)
    `),
    url: `${bq}/date_functions#date_trunc`,
    args: [
      {name: 'date_expression', type: 'T'},
      {name: 'date_part', type: 'kw', description: 'The date part to truncate to.'},
    ],
    returns: 'T',
    metadata: args => inferGrain(args[1]?.sql),
    sqlTemplate: 'DATE_TRUNC(${date_expression}, ${date_part})',
  },
  {
    name: 'format_date',
    description: trim(`
      FORMAT_DATE(format_string, date_expression)

      Formats a DATE value according to the specified format_string.

      See the supported format elements for DATE.

      Returned Data Types: STRING
    `),
    url: `${bq}/date_functions#format_date`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'date_expression', type: 'date'},
    ],
    returns: 'string',
  },
  {
    name: 'last_day',
    description: trim(`
      LAST_DAY(date_expression[, date_part])

      Returns the last day from a DATE value that contains the date. This is commonly used to return the last day of the month.

      You can optionally specify a date_part for which the last day is returned. If this parameter is not used, the default value is MONTH.

      LAST_DAY supports the following values for date_part: YEAR, QUARTER, MONTH, WEEK, WEEK(<WEEKDAY>), ISOWEEK, ISOYEAR.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#last_day`,
    args: [
      {name: 'date_expression', type: 'date'},
      {name: 'date_part', type: 'string?', description: 'The date part. Defaults to MONTH.'},
    ],
    returns: 'date',
  },
  {
    name: 'parse_date',
    description: trim(`
      PARSE_DATE(format_string, date_string)

      Converts a STRING value to a DATE value.

      When using PARSE_DATE, keep the following in mind:
      - Unspecified fields. Any unspecified field is initialized from 1970-01-01.
      - Case insensitivity. Names, such as Monday, February, and so on, are case insensitive.
      - Whitespace. One or more consecutive white spaces in the format string matches zero or more consecutive white spaces in the date string.
      - Format precedence. When two (or more) format elements have overlapping information, the last one generally overrides any earlier ones.

      Returned Data Types: DATE
    `),
    url: `${bq}/date_functions#parse_date`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'date_string', type: 'string', description: 'The date string to parse.'},
    ],
    returns: 'date',
  },
  {
    name: 'unix_date',
    description: trim(`
      UNIX_DATE(date_expression)

      Returns the number of days since 1970-01-01.

      Returned Data Types: INT64
    `),
    url: `${bq}/date_functions#unix_date`,
    args: [['date_expression', 'date']],
    returns: 'number',
  },

  // ============================================================================
  // Datetime Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions
  // ============================================================================

  {
    name: 'current_datetime',
    description: trim(`
      CURRENT_DATETIME([time_zone])

      Returns the current DATETIME value. Parentheses are optional when called with no arguments.

      This function supports an optional time_zone parameter. If no time zone is specified, the default time zone, UTC, is used.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#current_datetime`,
    args: [{name: 'time_zone', type: 'string?', description: 'The time zone to use. Defaults to UTC.'}],
    returns: 'timestamp',
    supportsBareInvocation: true,
  },
  {
    name: 'local_timestamp',
    description: trim(`
      Returns the current local timestamp (DATETIME in BigQuery).

      This is a Graphene alias for CURRENT_DATETIME().
    `),
    url: `${bq}/datetime_functions#current_datetime`,
    args: [],
    returns: 'timestamp',
    sqlName: 'CURRENT_DATETIME',
    supportsBareInvocation: true,
  },
  {
    name: 'datetime',
    description: trim(`
      DATETIME(year, month, day, hour, minute, second)
      DATETIME(date_expression[, time_expression])
      DATETIME(timestamp_expression[, time_zone])

      Constructs a DATETIME value.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#datetime`,
    args: [
      {name: 'year_or_date_or_timestamp', type: 'any'},
      {name: 'month_or_time_or_timezone', type: 'any?'},
      {name: 'day', type: 'number?'},
      {name: 'hour', type: 'number?'},
      {name: 'minute', type: 'number?'},
      {name: 'second', type: 'number?'},
    ],
    returns: 'datetime',
  },
  {
    name: 'datetime_add',
    description: trim(`
      DATETIME_ADD(datetime_expression, INTERVAL int64_expression part)

      Adds int64_expression units of part to the DATETIME value.

      DATETIME_ADD supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, YEAR.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#datetime_add`,
    args: [
      {name: 'datetime_expression', type: 'datetime'},
      {name: 'interval', type: 'number', description: 'The interval value to add.'},
    ],
    returns: 'datetime',
  },
  {
    name: 'datetime_diff',
    description: trim(`
      DATETIME_DIFF(datetime_expression_a, datetime_expression_b, part)

      Returns the whole number of specified part intervals between two DATETIME values. The first DATETIME is the later value, the second is the earlier.

      DATETIME_DIFF supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY, WEEK, WEEK(<WEEKDAY>), ISOWEEK, MONTH, QUARTER, YEAR, ISOYEAR.

      Returned Data Types: INT64
    `),
    url: `${bq}/datetime_functions#datetime_diff`,
    args: [
      {name: 'datetime_a', type: 'datetime', description: 'The later datetime.'},
      {name: 'datetime_b', type: 'datetime', description: 'The earlier datetime.'},
      {name: 'part', type: 'string', description: 'The part to use for the difference.'},
    ],
    returns: 'number',
  },
  {
    name: 'datetime_sub',
    description: trim(`
      DATETIME_SUB(datetime_expression, INTERVAL int64_expression part)

      Subtracts int64_expression units of part from the DATETIME value.

      DATETIME_SUB supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, YEAR.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#datetime_sub`,
    args: [
      {name: 'datetime_expression', type: 'datetime'},
      {name: 'interval', type: 'number', description: 'The interval value to subtract.'},
    ],
    returns: 'datetime',
  },
  {
    name: 'datetime_trunc',
    description: trim(`
      DATETIME_TRUNC(datetime_expression, part)

      Truncates a DATETIME value to the granularity of part.

      DATETIME_TRUNC supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY, WEEK, WEEK(<WEEKDAY>), ISOWEEK, MONTH, QUARTER, YEAR, ISOYEAR.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#datetime_trunc`,
    args: [
      {name: 'datetime_expression', type: 'datetime'},
      {name: 'part', type: 'string', description: 'The part to truncate to.'},
    ],
    returns: 'datetime',
    metadata: args => inferGrain(args[1]?.sql),
  },
  {
    name: 'format_datetime',
    description: trim(`
      FORMAT_DATETIME(format_string, datetime_expression)

      Formats a DATETIME value according to the specified format_string.

      See the supported format elements for DATETIME.

      Returned Data Types: STRING
    `),
    url: `${bq}/datetime_functions#format_datetime`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'datetime_expression', type: 'datetime'},
    ],
    returns: 'string',
  },
  {
    name: 'parse_datetime',
    description: trim(`
      PARSE_DATETIME(format_string, datetime_string)

      Converts a STRING value to a DATETIME value.

      When using PARSE_DATETIME, keep the following in mind:
      - Unspecified fields. Any unspecified field is initialized from 1970-01-01 00:00:00.
      - Case insensitivity. Names, such as Monday, February, and so on, are case insensitive.
      - Whitespace. One or more consecutive white spaces in the format string matches zero or more consecutive white spaces in the datetime string.
      - Format precedence. When two (or more) format elements have overlapping information, the last one generally overrides any earlier ones.

      Returned Data Types: DATETIME
    `),
    url: `${bq}/datetime_functions#parse_datetime`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'datetime_string', type: 'string', description: 'The datetime string to parse.'},
    ],
    returns: 'datetime',
  },

  // ============================================================================
  // Time Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/time_functions
  // ============================================================================

  {
    name: 'current_time',
    description: trim(`
      CURRENT_TIME([time_zone])

      Returns the current TIME value. Parentheses are optional when called with no arguments.

      This function supports an optional time_zone parameter. If no time zone is specified, the default time zone, UTC, is used.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#current_time`,
    args: [{name: 'time_zone', type: 'string?', description: 'The time zone to use. Defaults to UTC.'}],
    returns: 'timestamp', // Graphene treats TIME as timestamp
    supportsBareInvocation: true,
  },
  {
    name: 'time',
    description: trim(`
      TIME(hour, minute, second)
      TIME(timestamp, [time_zone])
      TIME(datetime)

      Constructs a TIME value.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#time`,
    args: [
      {name: 'hour_or_timestamp_or_datetime', type: 'any'},
      {name: 'minute_or_timezone', type: 'any?'},
      {name: 'second', type: 'number?'},
    ],
    returns: 'time',
  },
  {
    name: 'time_add',
    description: trim(`
      TIME_ADD(time_expression, INTERVAL int64_expression part)

      Adds int64_expression units of part to the TIME value.

      TIME_ADD supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR.

      This function automatically adjusts when values fall outside the 00:00:00 to 24:00:00 boundary.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#time_add`,
    args: [
      {name: 'time_expression', type: 'time'},
      {name: 'interval', type: 'number', description: 'The interval value to add.'},
    ],
    returns: 'time',
  },
  {
    name: 'time_diff',
    description: trim(`
      TIME_DIFF(time_expression_a, time_expression_b, part)

      Returns the whole number of specified part intervals between two TIME values. The first TIME is the later value, the second is the earlier.

      TIME_DIFF supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR.

      Returned Data Types: INT64
    `),
    url: `${bq}/time_functions#time_diff`,
    args: [
      {name: 'time_a', type: 'time', description: 'The later time.'},
      {name: 'time_b', type: 'time', description: 'The earlier time.'},
      {name: 'part', type: 'string', description: 'The part to use for the difference.'},
    ],
    returns: 'number',
  },
  {
    name: 'time_sub',
    description: trim(`
      TIME_SUB(time_expression, INTERVAL int64_expression part)

      Subtracts int64_expression units of part from the TIME value.

      TIME_SUB supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR.

      This function automatically adjusts when values fall outside the 00:00:00 to 24:00:00 boundary.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#time_sub`,
    args: [
      {name: 'time_expression', type: 'time'},
      {name: 'interval', type: 'number', description: 'The interval value to subtract.'},
    ],
    returns: 'time',
  },
  {
    name: 'time_trunc',
    description: trim(`
      TIME_TRUNC(time_expression, part)

      Truncates a TIME value to the granularity of part.

      TIME_TRUNC supports the following values for part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#time_trunc`,
    args: [
      {name: 'time_expression', type: 'time'},
      {name: 'part', type: 'string', description: 'The part to truncate to.'},
    ],
    returns: 'time',
    metadata: args => inferGrain(args[1]?.sql),
  },
  {
    name: 'format_time',
    description: trim(`
      FORMAT_TIME(format_string, time_expression)

      Formats a TIME value according to the specified format_string.

      See the supported format elements for TIME.

      Returned Data Types: STRING
    `),
    url: `${bq}/time_functions#format_time`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'time_expression', type: 'time'},
    ],
    returns: 'string',
  },
  {
    name: 'parse_time',
    description: trim(`
      PARSE_TIME(format_string, time_string)

      Converts a STRING value to a TIME value.

      When using PARSE_TIME, keep the following in mind:
      - Unspecified fields. Any unspecified field is initialized from 00:00:00.0.
      - Whitespace. One or more consecutive white spaces in the format string matches zero or more consecutive white spaces in the time string.
      - Format precedence. When two (or more) format elements have overlapping information, the last one generally overrides any earlier ones.

      Returned Data Types: TIME
    `),
    url: `${bq}/time_functions#parse_time`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'time_string', type: 'string', description: 'The time string to parse.'},
    ],
    returns: 'time',
  },

  // ============================================================================
  // Timestamp Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions
  // ============================================================================

  {
    name: 'current_timestamp',
    description: trim(`
      CURRENT_TIMESTAMP([time_zone])

      Returns the current TIMESTAMP value. Parentheses are optional when called with no arguments.

      This function supports an optional time_zone parameter.

      This function handles leap seconds by smearing them across a window of 20 hours around the inserted leap second.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#current_timestamp`,
    args: [{name: 'time_zone', type: 'string?', description: 'The time zone to use.'}],
    returns: 'timestamp',
    supportsBareInvocation: true,
  },
  {
    name: 'timestamp',
    description: trim(`
      TIMESTAMP(string_expression[, time_zone])
      TIMESTAMP(date_expression[, time_zone])
      TIMESTAMP(datetime_expression[, time_zone])

      Converts a STRING, DATE, or DATETIME expression to a TIMESTAMP.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp`,
    args: [
      {name: 'expression', type: 'any', description: 'A STRING, DATE, or DATETIME expression.'},
      {name: 'time_zone', type: 'string?', description: 'The time zone to use.'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_add',
    description: trim(`
      TIMESTAMP_ADD(timestamp_expression, INTERVAL int64_expression date_part)

      Adds int64_expression units of date_part to the TIMESTAMP value, independent of any time zone.

      TIMESTAMP_ADD supports the following values for date_part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_add`,
    args: [
      {name: 'timestamp_expression', type: 'timestamp'},
      {name: 'interval', type: 'number', description: 'The interval value to add.'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_diff',
    description: trim(`
      TIMESTAMP_DIFF(timestamp_expression_a, timestamp_expression_b, date_part)

      Returns the whole number of specified date_part intervals between two TIMESTAMP values. The first TIMESTAMP is the later value, the second is the earlier.

      TIMESTAMP_DIFF supports the following values for date_part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY.

      Returned Data Types: INT64
    `),
    url: `${bq}/timestamp_functions#timestamp_diff`,
    args: [
      {name: 'timestamp_a', type: 'timestamp', description: 'The later timestamp.'},
      {name: 'timestamp_b', type: 'timestamp', description: 'The earlier timestamp.'},
      {name: 'date_part', type: 'kw', description: 'The date part to use for the difference.'},
    ],
    returns: 'number',
  },
  {
    name: 'timestamp_sub',
    description: trim(`
      TIMESTAMP_SUB(timestamp_expression, INTERVAL int64_expression date_part)

      Subtracts int64_expression units of date_part from the TIMESTAMP value, independent of any time zone.

      TIMESTAMP_SUB supports the following values for date_part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_sub`,
    args: [
      {name: 'timestamp_expression', type: 'timestamp'},
      {name: 'interval', type: 'number', description: 'The interval value to subtract.'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_trunc',
    description: trim(`
      TIMESTAMP_TRUNC(timestamp_expression, date_part[, time_zone])

      Truncates a TIMESTAMP value to the granularity of date_part.

      TIMESTAMP_TRUNC supports the following values for date_part: MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY, WEEK, WEEK(<WEEKDAY>), ISOWEEK, MONTH, QUARTER, YEAR, ISOYEAR.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_trunc`,
    args: [
      {name: 'timestamp_expression', type: 'timestamp'},
      {name: 'date_part', type: 'string', description: 'The date part to truncate to.'},
      {name: 'time_zone', type: 'string?', description: 'The time zone to use.'},
    ],
    returns: 'timestamp',
    metadata: args => inferGrain(args[1]?.sql),
  },
  {
    name: 'format_timestamp',
    description: trim(`
      FORMAT_TIMESTAMP(format_string, timestamp_expression[, time_zone])

      Formats a TIMESTAMP value according to the specified format_string.

      See the supported format elements for TIMESTAMP.

      Returned Data Types: STRING
    `),
    url: `${bq}/timestamp_functions#format_timestamp`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'timestamp_expression', type: 'timestamp'},
      {name: 'time_zone', type: 'string?', description: 'The time zone to use.'},
    ],
    returns: 'string',
  },
  {
    name: 'parse_timestamp',
    description: trim(`
      PARSE_TIMESTAMP(format_string, timestamp_string[, time_zone])

      Converts a STRING value to a TIMESTAMP value.

      When using PARSE_TIMESTAMP, keep the following in mind:
      - Unspecified fields. Any unspecified field is initialized from 1970-01-01 00:00:00.0 UTC.
      - Case insensitivity. Names, such as Monday, February, and so on, are case insensitive.
      - Whitespace. One or more consecutive white spaces in the format string matches zero or more consecutive white spaces in the timestamp string.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#parse_timestamp`,
    args: [
      {name: 'format_string', type: 'string', description: 'The format string.'},
      {name: 'timestamp_string', type: 'string', description: 'The timestamp string to parse.'},
      {name: 'time_zone', type: 'string?', description: 'The time zone to use.'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_micros',
    description: trim(`
      TIMESTAMP_MICROS(int64_expression)

      Interprets int64_expression as the number of microseconds since 1970-01-01 00:00:00 UTC and returns a TIMESTAMP.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_micros`,
    args: [['microseconds', 'number']],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_millis',
    description: trim(`
      TIMESTAMP_MILLIS(int64_expression)

      Interprets int64_expression as the number of milliseconds since 1970-01-01 00:00:00 UTC and returns a TIMESTAMP.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_millis`,
    args: [['milliseconds', 'number']],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_seconds',
    description: trim(`
      TIMESTAMP_SECONDS(int64_expression)

      Interprets int64_expression as the number of seconds since 1970-01-01 00:00:00 UTC and returns a TIMESTAMP.

      Returned Data Types: TIMESTAMP
    `),
    url: `${bq}/timestamp_functions#timestamp_seconds`,
    args: [['seconds', 'number']],
    returns: 'timestamp',
  },
  {
    name: 'unix_micros',
    description: trim(`
      UNIX_MICROS(timestamp_expression)

      Returns the number of microseconds since 1970-01-01 00:00:00 UTC.

      Returned Data Types: INT64
    `),
    url: `${bq}/timestamp_functions#unix_micros`,
    args: [['timestamp_expression', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'unix_millis',
    description: trim(`
      UNIX_MILLIS(timestamp_expression)

      Returns the number of milliseconds since 1970-01-01 00:00:00 UTC. Truncates higher levels of precision by rounding down to the beginning of the millisecond.

      Returned Data Types: INT64
    `),
    url: `${bq}/timestamp_functions#unix_millis`,
    args: [['timestamp_expression', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'unix_seconds',
    description: trim(`
      UNIX_SECONDS(timestamp_expression)

      Returns the number of seconds since 1970-01-01 00:00:00 UTC. Truncates higher levels of precision by rounding down to the beginning of the second.

      Returned Data Types: INT64
    `),
    url: `${bq}/timestamp_functions#unix_seconds`,
    args: [['timestamp_expression', 'timestamp']],
    returns: 'number',
  },

  // ============================================================================
  // Interval Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/interval_functions
  // ============================================================================

  {
    name: 'make_interval',
    description: trim(`
      MAKE_INTERVAL([year][, month][, day][, hour][, minute][, second])

      Constructs an INTERVAL value.

      All arguments are optional with default value of 0. The resulting INTERVAL represents (year * 12 + month) months, (day * 24 + hour) hours, and (minute * 60 + second) seconds.

      Returned Data Types: INTERVAL
    `),
    url: `${bq}/interval_functions#make_interval`,
    args: [
      {name: 'year', type: 'number?', description: 'Number of years.'},
      {name: 'month', type: 'number?', description: 'Number of months.'},
      {name: 'day', type: 'number?', description: 'Number of days.'},
      {name: 'hour', type: 'number?', description: 'Number of hours.'},
      {name: 'minute', type: 'number?', description: 'Number of minutes.'},
      {name: 'second', type: 'number?', description: 'Number of seconds.'},
    ],
    returns: 'interval',
  },
  {
    name: 'justify_days',
    description: trim(`
      JUSTIFY_DAYS(interval_expression)

      Normalizes the day part of the interval to the range of -29 to 29 by incrementing/decrementing the month or year part of the interval.

      Returned Data Types: INTERVAL
    `),
    url: `${bq}/interval_functions#justify_days`,
    args: [['interval_expression', 'interval']],
    returns: 'interval',
  },
  {
    name: 'justify_hours',
    description: trim(`
      JUSTIFY_HOURS(interval_expression)

      Normalizes the time part of the interval to the range of -23:59:59.999999 to 23:59:59.999999 by incrementing/decrementing the day part of the interval.

      Returned Data Types: INTERVAL
    `),
    url: `${bq}/interval_functions#justify_hours`,
    args: [['interval_expression', 'interval']],
    returns: 'interval',
  },
  {
    name: 'justify_interval',
    description: trim(`
      JUSTIFY_INTERVAL(interval_expression)

      Normalizes the days and time parts of the interval.

      Returned Data Types: INTERVAL
    `),
    url: `${bq}/interval_functions#justify_interval`,
    args: [['interval_expression', 'interval']],
    returns: 'interval',
  },

  // ============================================================================
  // Array Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions
  // ============================================================================

  {
    name: 'array_concat',
    description: trim(`
      ARRAY_CONCAT(array_expression[, ...])

      Concatenates one or more arrays with the same element type into a single array. Returns NULL if any input argument is NULL.

      Returned Data Types: ARRAY
    `),
    url: `${bq}/array_functions#array_concat`,
    args: [['arrays', 'array...']],
    returns: 'array',
  },
  {
    name: 'array_first',
    description: trim(`
      ARRAY_FIRST(array_expression)

      Returns the first element of an array. If the input is an empty array, raises an error. To get NULL for an empty array instead, use ARRAY_FIRST_SAFE.

      Returned Data Types: Matches the element type of the array.
    `),
    url: `${bq}/array_functions#array_first`,
    args: [['array_expression', 'array']],
    returns: 'T',
  },
  {
    name: 'array_last',
    description: trim(`
      ARRAY_LAST(array_expression)

      Returns the last element of an array. If the input is an empty array, raises an error. To get NULL for an empty array instead, use ARRAY_LAST_SAFE.

      Returned Data Types: Matches the element type of the array.
    `),
    url: `${bq}/array_functions#array_last`,
    args: [['array_expression', 'array']],
    returns: 'T',
  },
  {
    name: 'array_length',
    description: trim(`
      ARRAY_LENGTH(array_expression)

      Returns the number of elements in an array. Returns 0 for an empty array. Returns NULL if array_expression is NULL.

      Returned Data Types: INT64
    `),
    url: `${bq}/array_functions#array_length`,
    args: [['array_expression', 'array']],
    returns: 'number',
  },
  {
    name: 'array_reverse',
    description: trim(`
      ARRAY_REVERSE(array_expression)

      Returns the input array with its elements in reverse order.

      Returned Data Types: ARRAY
    `),
    url: `${bq}/array_functions#array_reverse`,
    args: [['array_expression', 'array']],
    returns: 'array',
  },
  {
    name: 'array_slice',
    description: trim(`
      ARRAY_SLICE(array_to_slice, start_offset, end_offset)

      Returns an array containing zero or more consecutive elements from the input array.

      Definitions:
      - array_to_slice: The array that contains the elements to return.
      - start_offset: The 0-based inclusive starting offset for elements to return.
      - end_offset: The 0-based exclusive ending offset for elements to return.

      Returned Data Types: ARRAY
    `),
    url: `${bq}/array_functions#array_slice`,
    args: [
      {name: 'array_to_slice', type: 'array', description: 'The array to slice.'},
      {name: 'start_offset', type: 'number', description: 'The 0-based inclusive starting offset.'},
      {name: 'end_offset', type: 'number', description: 'The 0-based exclusive ending offset.'},
    ],
    returns: 'array',
  },
  {
    name: 'array_to_string',
    description: trim(`
      ARRAY_TO_STRING(array_expression, delimiter[, null_text])

      Returns a concatenation of the elements in array_expression as a STRING. The value for array_expression can either be an array of STRING or BYTES data types.

      If the null_text parameter is used, the function replaces any NULL values in the array with the value of null_text. If null_text is not specified, NULL values are omitted.

      Returned Data Types: STRING or BYTES
    `),
    url: `${bq}/array_functions#array_to_string`,
    args: [
      {name: 'array_expression', type: 'array'},
      {name: 'delimiter', type: 'string'},
      {name: 'null_text', type: 'string?', description: 'Text to use for NULL values.'},
    ],
    returns: 'string',
  },
  {
    name: 'generate_array',
    description: trim(`
      GENERATE_ARRAY(start_expression, end_expression[, step_expression])

      Returns an array of values. The start_expression and end_expression parameters determine the inclusive start and end of the array.

      The step_expression parameter determines the increment used to generate array values. The default value is 1 for INT64, NUMERIC, BIGNUMERIC, and FLOAT64 types.

      Returned Data Types: ARRAY
    `),
    url: `${bq}/array_functions#generate_array`,
    args: [
      {name: 'start_expression', type: 'number', description: 'The inclusive start value.'},
      {name: 'end_expression', type: 'number', description: 'The inclusive end value.'},
      {name: 'step_expression', type: 'number?', description: 'The increment. Defaults to 1.'},
    ],
    returns: 'array',
  },
  {
    name: 'generate_date_array',
    description: trim(`
      GENERATE_DATE_ARRAY(start_date, end_date[, INTERVAL int64_expression date_part])

      Returns an array of dates. The start_date and end_date parameters determine the inclusive start and end of the array.

      The optional INTERVAL clause is used to specify a step. The default is 1 DAY.

      Returned Data Types: ARRAY<DATE>
    `),
    url: `${bq}/array_functions#generate_date_array`,
    args: [
      {name: 'start_date', type: 'date', description: 'The inclusive start date.'},
      {name: 'end_date', type: 'date', description: 'The inclusive end date.'},
      {name: 'step', type: 'number?', description: 'The interval step. Defaults to 1 DAY.'},
    ],
    returns: 'array',
  },
  {
    name: 'generate_timestamp_array',
    description: trim(`
      GENERATE_TIMESTAMP_ARRAY(start_timestamp, end_timestamp, INTERVAL step_expression date_part)

      Returns an ARRAY of TIMESTAMPs separated by a given interval. The start_timestamp and end_timestamp parameters determine the inclusive lower and upper bounds of the ARRAY.

      Returned Data Types: ARRAY<TIMESTAMP>
    `),
    url: `${bq}/array_functions#generate_timestamp_array`,
    args: [
      {name: 'start_timestamp', type: 'timestamp', description: 'The inclusive start timestamp.'},
      {name: 'end_timestamp', type: 'timestamp', description: 'The inclusive end timestamp.'},
      {name: 'step', type: 'number', description: 'The interval step.'},
    ],
    returns: 'array',
  },

  // ============================================================================
  // JSON Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions
  // ============================================================================

  {
    name: 'json_extract',
    description: trim(`
      JSON_EXTRACT(json_string_expr, json_path)
      JSON_EXTRACT(json_expr, json_path)

      Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value. This function uses single quotes and brackets to escape invalid JSONPath characters in JSON keys.

      Arguments:
      - json_string_expr: A JSON-formatted string.
      - json_expr: JSON. For example, JSON '{"class": {"students": [{"name": "Jane"}]}}'.
      - json_path: The JSONPath. This identifies the data that you want to obtain from the input.

      Returned Data Types: JSON-formatted STRING or JSON
    `),
    url: `${bq}/json_functions#json_extract`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string', description: 'The JSONPath to extract.'},
    ],
    returns: 'json',
  },
  {
    name: 'json_extract_array',
    description: trim(`
      JSON_EXTRACT_ARRAY(json_string_expr[, json_path])
      JSON_EXTRACT_ARRAY(json_expr[, json_path])

      Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value. This function uses single quotes and brackets to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: ARRAY<JSON-formatted STRING> or ARRAY<JSON>
    `),
    url: `${bq}/json_functions#json_extract_array`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to extract.'},
    ],
    returns: 'array',
  },
  {
    name: 'json_extract_scalar',
    description: trim(`
      JSON_EXTRACT_SCALAR(json_string_expr[, json_path])
      JSON_EXTRACT_SCALAR(json_expr[, json_path])

      Extracts a JSON scalar value and converts it to a SQL STRING value. This function uses single quotes and brackets to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: STRING
    `),
    url: `${bq}/json_functions#json_extract_scalar`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to extract.'},
    ],
    returns: 'string',
  },
  {
    name: 'json_extract_string_array',
    description: trim(`
      JSON_EXTRACT_STRING_ARRAY(json_string_expr[, json_path])
      JSON_EXTRACT_STRING_ARRAY(json_expr[, json_path])

      Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value. This function uses single quotes and brackets to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: ARRAY<STRING>
    `),
    url: `${bq}/json_functions#json_extract_string_array`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to extract.'},
    ],
    returns: 'array',
  },
  {
    name: 'json_query',
    description: trim(`
      JSON_QUERY(json_string_expr, json_path)
      JSON_QUERY(json_expr, json_path)

      Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value. This function uses double quotes to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: JSON-formatted STRING or JSON
    `),
    url: `${bq}/json_functions#json_query`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string', description: 'The JSONPath to query.'},
    ],
    returns: 'json',
  },
  {
    name: 'json_query_array',
    description: trim(`
      JSON_QUERY_ARRAY(json_string_expr[, json_path])
      JSON_QUERY_ARRAY(json_expr[, json_path])

      Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value. This function uses double quotes to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: ARRAY<JSON-formatted STRING> or ARRAY<JSON>
    `),
    url: `${bq}/json_functions#json_query_array`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to query.'},
    ],
    returns: 'array',
  },
  {
    name: 'json_value',
    description: trim(`
      JSON_VALUE(json_string_expr[, json_path])
      JSON_VALUE(json_expr[, json_path])

      Extracts a JSON scalar value and converts it to a SQL STRING value. This function uses double quotes to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: STRING
    `),
    url: `${bq}/json_functions#json_value`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to query.'},
    ],
    returns: 'string',
  },
  {
    name: 'json_value_array',
    description: trim(`
      JSON_VALUE_ARRAY(json_string_expr[, json_path])
      JSON_VALUE_ARRAY(json_expr[, json_path])

      Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value. This function uses double quotes to escape invalid JSONPath characters in JSON keys.

      Returned Data Types: ARRAY<STRING>
    `),
    url: `${bq}/json_functions#json_value_array`,
    args: [
      {name: 'json_expr', type: 'any', description: 'A JSON value or JSON-formatted string.'},
      {name: 'json_path', type: 'string?', description: 'The JSONPath to query.'},
    ],
    returns: 'array',
  },
  {
    name: 'parse_json',
    description: trim(`
      PARSE_JSON(json_string_expr[, wide_number_mode=>{ 'exact' | 'round' }])

      Converts a JSON-formatted STRING value to a JSON value.

      Arguments:
      - json_string_expr: A JSON-formatted string.
      - wide_number_mode: Determines how to handle numbers that cannot be stored in a JSON value without the loss of precision. 'exact' (default) produces an error if a number cannot be stored without loss of precision. 'round' rounds the number to the nearest representable value.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#parse_json`,
    args: [
      {name: 'json_string_expr', type: 'string', description: 'A JSON-formatted string.'},
      {name: 'wide_number_mode', type: 'string?', description: "How to handle wide numbers: 'exact' (default) or 'round'."},
    ],
    returns: 'json',
  },
  {
    name: 'to_json',
    description: trim(`
      TO_JSON(sql_value[, stringify_wide_numbers=>{ TRUE | FALSE }])

      Converts a SQL value to a JSON value.

      Arguments:
      - sql_value: The SQL value to convert.
      - stringify_wide_numbers: If TRUE, numeric values that cannot be stored without loss of precision are converted to strings. Defaults to FALSE.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#to_json`,
    args: [
      {name: 'sql_value', type: 'any', description: 'The SQL value to convert.'},
      {name: 'stringify_wide_numbers', type: 'boolean?', description: 'If TRUE, converts wide numbers to strings.'},
    ],
    returns: 'json',
  },
  {
    name: 'to_json_string',
    description: trim(`
      TO_JSON_STRING(value[, pretty_print])

      Converts a SQL value to a JSON-formatted STRING value.

      Arguments:
      - value: The value to convert.
      - pretty_print: If TRUE, the returned value is formatted for easy readability.

      Returned Data Types: STRING
    `),
    url: `${bq}/json_functions#to_json_string`,
    args: [
      {name: 'value', type: 'any', description: 'The value to convert.'},
      {name: 'pretty_print', type: 'boolean?', description: 'If TRUE, formats for readability.'},
    ],
    returns: 'string',
  },
  {
    name: 'json_type',
    description: trim(`
      JSON_TYPE(json_expr)

      Returns the type of the outermost JSON value as a STRING.

      The returned STRING can be one of: 'null', 'boolean', 'number', 'string', 'array', 'object'.

      Returned Data Types: STRING
    `),
    url: `${bq}/json_functions#json_type`,
    args: [['json_expr', 'json']],
    returns: 'string',
  },
  {
    name: 'json_array',
    description: trim(`
      JSON_ARRAY([value[, ...]])

      Creates a JSON array from zero or more SQL values.

      Arguments:
      - value: A SQL value. Can be a JSON value.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#json_array`,
    args: [['values', 'any...']],
    returns: 'json',
  },
  {
    name: 'json_object',
    description: trim(`
      JSON_OBJECT([key, value[, ...]])

      Creates a JSON object from zero or more key-value pairs. Each key must be a SQL STRING and each value can be any SQL data type.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#json_object`,
    args: [['key_value_pairs', 'any...']],
    returns: 'json',
  },
  {
    name: 'json_keys',
    description: trim(`
      JSON_KEYS(json_expr[, max_depth])

      Returns the keys of a JSON object as an ARRAY<STRING>.

      Arguments:
      - json_expr: JSON expression.
      - max_depth: An optional INT64 that represents the maximum depth to search.

      Returned Data Types: ARRAY<STRING>
    `),
    url: `${bq}/json_functions#json_keys`,
    args: [
      {name: 'json_expr', type: 'json'},
      {name: 'max_depth', type: 'number?', description: 'Maximum depth to search.'},
    ],
    returns: 'array',
  },
  {
    name: 'json_set',
    description: trim(`
      JSON_SET(json_expr, json_path, value[, json_path, value[, ...]][, create_if_missing=>{ TRUE | FALSE }])

      Produces a new JSON value by inserting or replacing a value in a JSON value.

      Arguments:
      - json_expr: A JSON expression.
      - json_path: The path to insert/replace the value.
      - value: The value to insert.
      - create_if_missing: If TRUE (default), creates the path if it doesn't exist.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#json_set`,
    args: [
      {name: 'json_expr', type: 'json'},
      {name: 'json_path', type: 'string'},
      {name: 'value', type: 'any'},
    ],
    returns: 'json',
  },
  {
    name: 'json_remove',
    description: trim(`
      JSON_REMOVE(json_expr, json_path[, ...])

      Produces a new JSON value by removing paths from a JSON value.

      Arguments:
      - json_expr: A JSON expression.
      - json_path: One or more paths to remove.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#json_remove`,
    args: [
      {name: 'json_expr', type: 'json'},
      {name: 'json_paths', type: 'string...'},
    ],
    returns: 'json',
  },
  {
    name: 'json_strip_nulls',
    description: trim(`
      JSON_STRIP_NULLS(json_expr[, json_path][, include_arrays=>{ TRUE | FALSE }][, remove_empty=>{ TRUE | FALSE }])

      Removes JSON null values from a JSON value.

      Arguments:
      - json_expr: A JSON expression.
      - json_path: Optionally, a JSONPath to start from.
      - include_arrays: If TRUE, removes nulls from arrays too. Defaults to FALSE.
      - remove_empty: If TRUE, removes empty containers. Defaults to FALSE.

      Returned Data Types: JSON
    `),
    url: `${bq}/json_functions#json_strip_nulls`,
    args: [
      {name: 'json_expr', type: 'json'},
      {name: 'json_path', type: 'string?'},
    ],
    returns: 'json',
  },

  // ============================================================================
  // Hash Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions
  // ============================================================================

  {
    name: 'farm_fingerprint',
    description: trim(`
      FARM_FINGERPRINT(value)

      Computes the fingerprint of the STRING or BYTES input using the Fingerprint64 function from the open-source FarmHash library. The output of this function for a particular input will never change.

      Returned Data Types: INT64
    `),
    url: `${bq}/hash_functions#farm_fingerprint`,
    args: [['value', 'string']],
    returns: 'number',
  },
  {
    name: 'md5',
    description: trim(`
      MD5(input)

      Computes the hash of the input using the MD5 algorithm. The input can be either STRING or BYTES. The string version treats the input as an array of bytes.

      This function returns 16 bytes.

      Returned Data Types: BYTES
    `),
    url: `${bq}/hash_functions#md5`,
    args: [['input', 'string']],
    returns: 'bytes',
  },
  {
    name: 'sha1',
    description: trim(`
      SHA1(input)

      Computes the hash of the input using the SHA-1 algorithm. The input can be either STRING or BYTES. The string version treats the input as an array of bytes.

      This function returns 20 bytes.

      Returned Data Types: BYTES
    `),
    url: `${bq}/hash_functions#sha1`,
    args: [['input', 'string']],
    returns: 'bytes',
  },
  {
    name: 'sha256',
    description: trim(`
      SHA256(input)

      Computes the hash of the input using the SHA-256 algorithm. The input can be either STRING or BYTES. The string version treats the input as an array of bytes.

      This function returns 32 bytes.

      Returned Data Types: BYTES
    `),
    url: `${bq}/hash_functions#sha256`,
    args: [['input', 'string']],
    returns: 'bytes',
  },
  {
    name: 'sha512',
    description: trim(`
      SHA512(input)

      Computes the hash of the input using the SHA-512 algorithm. The input can be either STRING or BYTES. The string version treats the input as an array of bytes.

      This function returns 64 bytes.

      Returned Data Types: BYTES
    `),
    url: `${bq}/hash_functions#sha512`,
    args: [['input', 'string']],
    returns: 'bytes',
  },

  // ============================================================================
  // Statistical Aggregate Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/statistical_aggregate_functions
  // ============================================================================

  {
    name: 'corr',
    description: trim(`
      CORR(X, Y)

      Returns the Pearson coefficient of correlation of a set of number pairs. For each number pair, the first number is the dependent variable and the second number is the independent variable. The return result is between -1 and 1.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#corr`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_pop',
    description: trim(`
      COVAR_POP(X, Y)

      Returns the population covariance of a set of number pairs. The first number is the dependent variable; the second number is the independent variable.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#covar_pop`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_samp',
    description: trim(`
      COVAR_SAMP(X, Y)

      Returns the sample covariance of a set of number pairs. The first number is the dependent variable; the second number is the independent variable.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#covar_samp`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev',
    description: trim(`
      STDDEV([DISTINCT] expression)

      An alias for STDDEV_SAMP. Returns the sample (n-1) standard deviation of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#stddev`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_pop',
    description: trim(`
      STDDEV_POP([DISTINCT] expression)

      Returns the population (n) standard deviation of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#stddev_pop`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_samp',
    description: trim(`
      STDDEV_SAMP([DISTINCT] expression)

      Returns the sample (n-1) standard deviation of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#stddev_samp`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_pop',
    description: trim(`
      VAR_POP([DISTINCT] expression)

      Returns the population (n) variance of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#var_pop`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_samp',
    description: trim(`
      VAR_SAMP([DISTINCT] expression)

      Returns the sample (n-1) variance of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#var_samp`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'variance',
    description: trim(`
      VARIANCE([DISTINCT] expression)

      An alias for VAR_SAMP. Returns the sample (n-1) variance of the values.

      Returned Data Types: FLOAT64
    `),
    url: `${bq}/statistical_aggregate_functions#variance`,
    args: [['expression', 'number']],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Approximate Aggregate Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/approximate_aggregate_functions
  // ============================================================================

  {
    name: 'approx_count_distinct',
    description: trim(`
      APPROX_COUNT_DISTINCT(expression)

      Returns the approximate result for COUNT(DISTINCT expression). The value returned is a statistical estimate, not necessarily the actual value.

      This function is less accurate than COUNT(DISTINCT expression), but performs better on huge input.

      Returned Data Types: INT64
    `),
    url: `${bq}/approximate_aggregate_functions#approx_count_distinct`,
    args: [['expression', 'any']],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'approx_quantiles',
    description: trim(`
      APPROX_QUANTILES([DISTINCT] expression, number [{IGNORE | RESPECT} NULLS])

      Returns the approximate boundaries for a group of expression values, where number represents the number of quantiles to create. This function returns an array of number + 1 elements, sorted in ascending order.

      Returned Data Types: ARRAY
    `),
    url: `${bq}/approximate_aggregate_functions#approx_quantiles`,
    args: [
      {name: 'expression', type: 'any', description: 'The expression to compute quantiles for.'},
      {name: 'number', type: 'number', description: 'The number of quantiles to create.'},
    ],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'approx_top_count',
    description: trim(`
      APPROX_TOP_COUNT(expression, number)

      Returns the approximate top elements of expression as an array of STRUCTs. The number parameter specifies the number of elements returned.

      Each STRUCT contains two fields. The first field (named value) contains an input value. The second field (named count) contains an INT64 specifying the number of times the value was returned.

      Returned Data Types: ARRAY<STRUCT>
    `),
    url: `${bq}/approximate_aggregate_functions#approx_top_count`,
    args: [
      {name: 'expression', type: 'any', description: 'The expression to find top values for.'},
      {name: 'number', type: 'number', description: 'The number of top elements to return.'},
    ],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'approx_top_sum',
    description: trim(`
      APPROX_TOP_SUM(expression, weight, number)

      Returns the approximate top elements of expression, based on the sum of an assigned weight. The number parameter specifies the number of elements returned.

      Each STRUCT contains two fields: the first field (named value) contains an input value. The second field (named sum) contains an INT64 for the sum of the values of weight associated with value.

      Returned Data Types: ARRAY<STRUCT>
    `),
    url: `${bq}/approximate_aggregate_functions#approx_top_sum`,
    args: [
      {name: 'expression', type: 'any', description: 'The expression to find top values for.'},
      {name: 'weight', type: 'number', description: 'The weight to sum.'},
      {name: 'number', type: 'number', description: 'The number of top elements to return.'},
    ],
    returns: 'array',
    aggregate: true,
  },

  // ============================================================================
  // Bit Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions
  // ============================================================================

  {
    name: 'bit_count',
    description: trim(`
      BIT_COUNT(expression)

      Returns the number of bits that are set in the input expression. For signed integers, this is the number of bits in two's-complement form.

      Returned Data Types: INT64
    `),
    url: `${bq}/bit_functions#bit_count`,
    args: [['expression', 'any']],
    returns: 'number',
  },

  // ============================================================================
  // Conversion Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/conversion_functions
  // ============================================================================

  // Note: CAST and SAFE_CAST are SQL keywords, not functions, so they are handled specially
  // and not included here.
  {
    name: 'parse_numeric',
    description: trim(`
      PARSE_NUMERIC(string_expression)

      Converts a STRING value to a NUMERIC value.

      The numeric literal in the string can be optionally enclosed with quotes. If enclosed, the NUMERIC value can include a space before or after the enclosing quotes.

      Returned Data Types: NUMERIC
    `),
    url: `${bq}/conversion_functions#parse_numeric`,
    args: [['string_expression', 'string']],
    returns: 'number',
  },
  {
    name: 'parse_bignumeric',
    description: trim(`
      PARSE_BIGNUMERIC(string_expression)

      Converts a STRING value to a BIGNUMERIC value.

      The numeric literal in the string can be optionally enclosed with quotes. If enclosed, the BIGNUMERIC value can include a space before or after the enclosing quotes.

      Returned Data Types: BIGNUMERIC
    `),
    url: `${bq}/conversion_functions#parse_bignumeric`,
    args: [['string_expression', 'string']],
    returns: 'number',
  },

  // ============================================================================
  // Utility Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/utility-functions
  // ============================================================================

  {
    name: 'generate_uuid',
    description: trim(`
      GENERATE_UUID()

      Returns a random universally unique identifier (UUID) as a STRING. The returned UUID is a version 4 UUID.

      Returned Data Types: STRING
    `),
    url: `${bq}/utility-functions#generate_uuid`,
    args: [],
    returns: 'string',
  },
  {
    name: 'typeof',
    description: trim(`
      TYPEOF(expression)

      Returns the name of the data type of the expression, as a STRING.

      Returned Data Types: STRING
    `),
    url: `${bq}/utility-functions#typeof`,
    args: [['expression', 'any']],
    returns: 'string',
  },

  // ============================================================================
  // Debugging Functions
  // https://cloud.google.com/bigquery/docs/reference/standard-sql/debugging_functions
  // ============================================================================

  {
    name: 'error',
    description: trim(`
      ERROR(error_message)

      Produces an error with the given error_message. ERROR is used for conditional error handling.

      Returned Data Types: Never returns (always produces an error)
    `),
    url: `${bq}/debugging_functions#error`,
    args: [['error_message', 'string']],
    returns: 'never',
  },
]
