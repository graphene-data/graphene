// Snowflake SQL function definitions
// These get converted to Malloy blueprints in functions.ts
//
// Documentation is copied verbatim from:
// https://docs.snowflake.com/en/sql-reference/functions/

import type {FunctionDef} from './functionTypes.ts'
import {trimIndentation} from './util.ts'

const sf = 'https://docs.snowflake.com/en/sql-reference/functions'

// Helper to trim and dedent multiline strings
const trim = trimIndentation

export const snowflakeFunctions: FunctionDef[] = [
  // ============================================================================
  // Window Functions
  // https://docs.snowflake.com/en/sql-reference/functions-window
  // ============================================================================
  {
    name: 'row_number',
    description: trim('ROW_NUMBER() returns a unique row number for each row within the window partition.'),
    url: `${sf}/row_number`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'rank',
    description: trim('RANK() returns the rank of the current row with gaps for ties.'),
    url: `${sf}/rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'dense_rank',
    description: trim('DENSE_RANK() returns the rank of the current row without gaps.'),
    url: `${sf}/dense_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'ntile',
    description: trim('NTILE(constant_value) divides rows into buckets and returns the bucket number.'),
    url: `${sf}/ntile`,
    args: [{name: 'constant_value', type: 'number'}],
    returns: 'number',
    window: true,
  },
  {
    name: 'lag',
    description: trim('LAG(expr, offset, default) accesses data from a previous row in the window.'),
    url: `${sf}/lag`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'lead',
    description: trim('LEAD(expr, offset, default) accesses data from a following row in the window.'),
    url: `${sf}/lead`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'first_value',
    description: trim('FIRST_VALUE(expr) returns the first value in the window frame.'),
    url: `${sf}/first_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'last_value',
    description: trim('LAST_VALUE(expr) returns the last value in the window frame.'),
    url: `${sf}/last_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'nth_value',
    description: trim('NTH_VALUE(expr, n) returns the nth value in the window frame.'),
    url: `${sf}/nth_value`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'n', type: 'number'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'percent_rank',
    description: trim('PERCENT_RANK() returns the relative rank of the current row.'),
    url: `${sf}/percent_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'cume_dist',
    description: trim('CUME_DIST() returns the cumulative distribution value for the current row.'),
    url: `${sf}/cume_dist`,
    args: [],
    returns: 'number',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // https://docs.snowflake.com/en/sql-reference/functions-aggregation
  // ============================================================================

  {
    name: 'any_value',
    description: trim(`
      ANY_VALUE( [ DISTINCT ] <expr> )

      Returns any value from a set of values. This function is non-deterministic. When used with DISTINCT, any distinct value is returned.

      Returns NULL if all input values are NULL.
    `),
    url: `${sf}/any_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'array_agg',
    description: trim(`
      ARRAY_AGG( [ DISTINCT ] <expr> ) [ WITHIN GROUP ( <orderby_clause> ) ]

      Returns the input values, pivoted into an ARRAY. If the input is empty, an empty ARRAY is returned.
    `),
    url: `${sf}/array_agg`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'avg',
    description: trim(`
      AVG( [ DISTINCT ] <expr> )

      Returns the average of non-NULL records. If all records inside a group are NULL, the function returns NULL.
    `),
    url: `${sf}/avg`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'corr',
    description: trim(`
      CORR( <dependent>, <independent> )

      Returns the correlation coefficient for non-NULL pairs in a group.
    `),
    url: `${sf}/corr`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'count',
    description: trim(`
      COUNT( [ DISTINCT ] <expr> )
      COUNT(*)

      Returns the number of records that are not NULL, or the total number of records if using COUNT(*).

      If all records inside a group are NULL, the function returns 0.
    `),
    url: `${sf}/count`,
    args: [{name: 'expr', type: 'any?'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'count_if',
    description: trim(`
      COUNT_IF( <condition> )

      Returns the number of records that satisfy a condition.
    `),
    url: `${sf}/count_if`,
    args: [{name: 'condition', type: 'boolean'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_pop',
    description: trim(`
      COVAR_POP( <dependent>, <independent> )

      Returns the population covariance for non-NULL pairs in a group.
    `),
    url: `${sf}/covar_pop`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_samp',
    description: trim(`
      COVAR_SAMP( <dependent>, <independent> )

      Returns the sample covariance for non-NULL pairs in a group.
    `),
    url: `${sf}/covar_samp`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'listagg',
    description: trim(`
      LISTAGG( [ DISTINCT ] <expr> [, <delimiter>] ) [ WITHIN GROUP ( <orderby_clause> ) ]

      Returns the concatenated input values, separated by the delimiter string.
    `),
    url: `${sf}/listagg`,
    args: [
      {name: 'expr', type: 'string'},
      {name: 'delimiter', type: 'string?'},
    ],
    returns: 'string',
    aggregate: true,
  },
  {
    name: 'max',
    description: trim(`
      MAX( <expr> )

      Returns the maximum value for the records within expr. NULL values are ignored unless all the records are NULL, in which case a NULL value is returned.
    `),
    url: `${sf}/max`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'max_by',
    description: trim(`
      MAX_BY( <value_expr>, <order_expr> )

      Returns the value of value_expr that is associated with the maximum value of order_expr in a group.
    `),
    url: `${sf}/max_by`,
    args: [
      {name: 'value_expr', type: 'T'},
      {name: 'order_expr', type: 'any'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'median',
    description: trim(`
      MEDIAN( <expr> )

      Returns the median value for the records in expr. NULL values are ignored.
    `),
    url: `${sf}/median`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'min',
    description: trim(`
      MIN( <expr> )

      Returns the minimum value for the records within expr. NULL values are ignored unless all the records are NULL, in which case a NULL value is returned.
    `),
    url: `${sf}/min`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'min_by',
    description: trim(`
      MIN_BY( <value_expr>, <order_expr> )

      Returns the value of value_expr that is associated with the minimum value of order_expr in a group.
    `),
    url: `${sf}/min_by`,
    args: [
      {name: 'value_expr', type: 'T'},
      {name: 'order_expr', type: 'any'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'mode',
    description: trim(`
      MODE( <expr> )

      Returns the most frequent value for the records in expr. NULL values are ignored. If all the values are NULL, or there are 0 rows, then the function returns NULL.
    `),
    url: `${sf}/mode`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'stddev',
    description: trim(`
      STDDEV( [ DISTINCT ] <expr> )

      Returns the sample standard deviation (square root of sample variance) of non-NULL values. STDDEV is an alias for STDDEV_SAMP.
    `),
    url: `${sf}/stddev`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_samp',
    description: trim(`
      STDDEV_SAMP( [ DISTINCT ] <expr> )

      Returns the sample standard deviation (square root of sample variance) of non-NULL values.
    `),
    url: `${sf}/stddev`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_pop',
    description: trim(`
      STDDEV_POP( [ DISTINCT ] <expr> )

      Returns the population standard deviation (square root of population variance) of non-NULL values.
    `),
    url: `${sf}/stddev_pop`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'sum',
    description: trim(`
      SUM( [ DISTINCT ] <expr> )

      Returns the sum of non-NULL records for expr. You can use the DISTINCT keyword to compute the sum of unique non-null values. If all records inside a group are NULL, the function returns NULL.
    `),
    url: `${sf}/sum`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_pop',
    description: trim(`
      VAR_POP( [ DISTINCT ] <expr> )

      Returns the population variance of non-NULL records in a group. If all records inside a group are NULL, a NULL is returned.
    `),
    url: `${sf}/var_pop`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_samp',
    description: trim(`
      VAR_SAMP( [ DISTINCT ] <expr> )

      Returns the sample variance of non-NULL records in a group. If all records inside a group are NULL, a NULL is returned.
    `),
    url: `${sf}/var_samp`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'variance',
    description: trim(`
      VARIANCE( [ DISTINCT ] <expr> )

      Returns the sample variance of non-NULL records in a group. VARIANCE is an alias for VAR_SAMP.
    `),
    url: `${sf}/variance`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // Bitwise Aggregation
  {
    name: 'bitand_agg',
    description: trim(`
      BITAND_AGG( <expr> )

      Returns the bitwise AND of all non-NULL numeric input values.
    `),
    url: `${sf}/bitand_agg`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bitor_agg',
    description: trim(`
      BITOR_AGG( <expr> )

      Returns the bitwise OR of all non-NULL numeric input values.
    `),
    url: `${sf}/bitor_agg`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bitxor_agg',
    description: trim(`
      BITXOR_AGG( <expr> )

      Returns the bitwise XOR of all non-NULL numeric input values.
    `),
    url: `${sf}/bitxor_agg`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // Boolean Aggregation
  {
    name: 'booland_agg',
    description: trim(`
      BOOLAND_AGG( <expr> )

      Returns TRUE if all non-NULL input expressions are TRUE, otherwise FALSE.
    `),
    url: `${sf}/booland_agg`,
    args: [{name: 'expr', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
  },
  {
    name: 'boolor_agg',
    description: trim(`
      BOOLOR_AGG( <expr> )

      Returns TRUE if at least one non-NULL input expression is TRUE, otherwise FALSE.
    `),
    url: `${sf}/boolor_agg`,
    args: [{name: 'expr', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
  },
  {
    name: 'boolxor_agg',
    description: trim(`
      BOOLXOR_AGG( <expr> )

      Returns TRUE if exactly one non-NULL input expression is TRUE, otherwise FALSE.
    `),
    url: `${sf}/boolxor_agg`,
    args: [{name: 'expr', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
  },

  // Linear Regression
  {
    name: 'regr_avgx',
    description: trim(`
      REGR_AVGX( <dependent>, <independent> )

      Returns the average of the independent variable for non-NULL pairs.
    `),
    url: `${sf}/regr_avgx`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_avgy',
    description: trim(`
      REGR_AVGY( <dependent>, <independent> )

      Returns the average of the dependent variable for non-NULL pairs.
    `),
    url: `${sf}/regr_avgy`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_count',
    description: trim(`
      REGR_COUNT( <dependent>, <independent> )

      Returns the number of non-NULL pairs used to fit the regression line.
    `),
    url: `${sf}/regr_count`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_intercept',
    description: trim(`
      REGR_INTERCEPT( <dependent>, <independent> )

      Returns the y-intercept of the least-squares-fit linear equation determined by the (dependent, independent) pairs.
    `),
    url: `${sf}/regr_intercept`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_r2',
    description: trim(`
      REGR_R2( <dependent>, <independent> )

      Returns the coefficient of determination (also known as R-squared) for non-NULL pairs.
    `),
    url: `${sf}/regr_r2`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_slope',
    description: trim(`
      REGR_SLOPE( <dependent>, <independent> )

      Returns the slope of the least-squares-fit linear equation determined by the (dependent, independent) pairs.
    `),
    url: `${sf}/regr_slope`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_sxx',
    description: trim(`
      REGR_SXX( <dependent>, <independent> )

      Returns REGR_COUNT(dependent, independent) * VAR_POP(independent) for non-NULL pairs.
    `),
    url: `${sf}/regr_sxx`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_sxy',
    description: trim(`
      REGR_SXY( <dependent>, <independent> )

      Returns REGR_COUNT(dependent, independent) * COVAR_POP(dependent, independent) for non-NULL pairs.
    `),
    url: `${sf}/regr_sxy`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_syy',
    description: trim(`
      REGR_SYY( <dependent>, <independent> )

      Returns REGR_COUNT(dependent, independent) * VAR_POP(dependent) for non-NULL pairs.
    `),
    url: `${sf}/regr_syy`,
    args: [
      {name: 'dependent', type: 'number'},
      {name: 'independent', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },

  // Statistics
  {
    name: 'kurtosis',
    description: trim(`
      KURTOSIS( <expr> )

      Returns the excess kurtosis of its argument. A NULL value is returned if there are fewer than 4 records in the group.
    `),
    url: `${sf}/kurtosis`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'skew',
    description: trim(`
      SKEW( <expr> )

      Returns the sample skewness of the values in a group. A NULL value is returned if there are fewer than 3 records in the group.
    `),
    url: `${sf}/skew`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // Approximate Aggregation
  {
    name: 'approx_count_distinct',
    description: trim(`
      APPROX_COUNT_DISTINCT( <expr> )

      Uses HyperLogLog to return an approximation of the distinct cardinality of the input.
    `),
    url: `${sf}/approx_count_distinct`,
    args: [{name: 'expr', type: 'any'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'approx_percentile',
    description: trim(`
      APPROX_PERCENTILE( <expr>, <percentile> )

      Uses the t-Digest algorithm to return an approximation of the specified percentile.
    `),
    url: `${sf}/approx_percentile`,
    args: [
      {name: 'expr', type: 'number'},
      {name: 'percentile', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Numeric Functions
  // https://docs.snowflake.com/en/sql-reference/functions-numeric
  // ============================================================================

  {
    name: 'abs',
    description: trim(`
      ABS( <num_expr> )

      Returns the absolute value of a numeric expression.
    `),
    url: `${sf}/abs`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acos',
    description: trim(`
      ACOS( <real_expr> )

      Computes the inverse cosine (arc cosine) of its input; the result is a number in the interval [0, pi].
    `),
    url: `${sf}/acos`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acosh',
    description: trim(`
      ACOSH( <real_expr> )

      Computes the inverse hyperbolic cosine of its input.
    `),
    url: `${sf}/acosh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asin',
    description: trim(`
      ASIN( <real_expr> )

      Computes the inverse sine (arc sine) of its input; the result is a number in the interval [-pi/2, pi/2].
    `),
    url: `${sf}/asin`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asinh',
    description: trim(`
      ASINH( <real_expr> )

      Computes the inverse hyperbolic sine of its input.
    `),
    url: `${sf}/asinh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan',
    description: trim(`
      ATAN( <real_expr> )

      Computes the inverse tangent (arc tangent) of its input; the result is a number in the interval [-pi/2, pi/2].
    `),
    url: `${sf}/atan`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan2',
    description: trim(`
      ATAN2( <y>, <x> )

      Computes the inverse tangent (arc tangent) of the ratio of its two arguments.
    `),
    url: `${sf}/atan2`,
    args: [['y', 'number'], ['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atanh',
    description: trim(`
      ATANH( <real_expr> )

      Computes the inverse hyperbolic tangent of its input.
    `),
    url: `${sf}/atanh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cbrt',
    description: trim(`
      CBRT( <real_expr> )

      Returns the cube root of a numeric expression.
    `),
    url: `${sf}/cbrt`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ceil',
    description: trim(`
      CEIL( <input_expr> [, <scale_expr> ] )

      Returns values from input_expr rounded to the nearest equal or larger integer, or to the nearest equal or larger value with the specified number of places after the decimal point.
    `),
    url: `${sf}/ceil`,
    args: [['x', 'number'], ['scale', 'number?']],
    returns: 'number',
  },
  {
    name: 'cos',
    description: trim(`
      COS( <real_expr> )

      Computes the cosine of its argument; the argument should be expressed in radians.
    `),
    url: `${sf}/cos`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cosh',
    description: trim(`
      COSH( <real_expr> )

      Computes the hyperbolic cosine of its argument.
    `),
    url: `${sf}/cosh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cot',
    description: trim(`
      COT( <real_expr> )

      Computes the cotangent of its argument; the argument should be expressed in radians.
    `),
    url: `${sf}/cot`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'degrees',
    description: trim(`
      DEGREES( <real_expr> )

      Converts radians to degrees.
    `),
    url: `${sf}/degrees`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'div0',
    description: trim(`
      DIV0( <dividend>, <divisor> )

      Performs division like the division operator (/), but returns 0 when the divisor is 0 (rather than reporting an error).
    `),
    url: `${sf}/div0`,
    args: [['dividend', 'number'], ['divisor', 'number']],
    returns: 'number',
  },
  {
    name: 'div0null',
    description: trim(`
      DIV0NULL( <dividend>, <divisor> )

      Performs division like the division operator (/), but returns NULL when the divisor is 0 or NULL (rather than reporting an error).
    `),
    url: `${sf}/div0null`,
    args: [['dividend', 'number'], ['divisor', 'number']],
    returns: 'number',
  },
  {
    name: 'exp',
    description: trim(`
      EXP( <real_expr> )

      Computes Euler's number e raised to a floating-point value.
    `),
    url: `${sf}/exp`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'factorial',
    description: trim(`
      FACTORIAL( <integer_expr> )

      Computes the factorial of its input. The input must be an integer in the range 0 to 33.
    `),
    url: `${sf}/factorial`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'floor',
    description: trim(`
      FLOOR( <input_expr> [, <scale_expr> ] )

      Returns values from input_expr rounded to the nearest equal or smaller integer, or to the nearest equal or smaller value with the specified number of places after the decimal point.
    `),
    url: `${sf}/floor`,
    args: [['x', 'number'], ['scale', 'number?']],
    returns: 'number',
  },
  {
    name: 'ln',
    description: trim(`
      LN( <real_expr> )

      Returns the natural logarithm of a numeric expression.
    `),
    url: `${sf}/ln`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'log',
    description: trim(`
      LOG( <base>, <expr> )

      Returns the logarithm of a numeric expression.
    `),
    url: `${sf}/log`,
    args: [['base', 'number'], ['x', 'number']],
    returns: 'number',
  },
  {
    name: 'mod',
    description: trim(`
      MOD( <expr1>, <expr2> )

      Returns the remainder of expr1 divided by expr2.
    `),
    url: `${sf}/mod`,
    args: [['x', 'number'], ['y', 'number']],
    returns: 'number',
  },
  {
    name: 'pi',
    description: trim(`
      PI()

      Returns the value of pi, which is approximately 3.14159265358979323846.
    `),
    url: `${sf}/pi`,
    args: [],
    returns: 'number',
  },
  {
    name: 'pow',
    description: trim(`
      POW( <x>, <y> )
      POWER( <x>, <y> )

      Returns x raised to the power of y.
    `),
    url: `${sf}/pow`,
    args: [['x', 'number'], ['y', 'number']],
    returns: 'number',
  },
  {
    name: 'power',
    description: trim(`
      POWER( <x>, <y> )

      Returns x raised to the power of y. Alias for POW.
    `),
    url: `${sf}/pow`,
    args: [['x', 'number'], ['y', 'number']],
    returns: 'number',
  },
  {
    name: 'radians',
    description: trim(`
      RADIANS( <real_expr> )

      Converts degrees to radians.
    `),
    url: `${sf}/radians`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'random',
    description: trim(`
      RANDOM( [<seed>] )

      Returns a pseudo-random 64-bit integer.
    `),
    url: `${sf}/random`,
    args: [{name: 'seed', type: 'number?'}],
    returns: 'number',
  },
  {
    name: 'round',
    description: trim(`
      ROUND( <input_expr> [, <scale_expr> ] [, <rounding_mode> ] )

      Returns rounded values for input_expr.
    `),
    url: `${sf}/round`,
    args: [['x', 'number'], ['scale', 'number?']],
    returns: 'number',
  },
  {
    name: 'sign',
    description: trim(`
      SIGN( <num_expr> )

      Returns the sign of a numeric value: -1 for negative, 0 for zero, 1 for positive.
    `),
    url: `${sf}/sign`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sin',
    description: trim(`
      SIN( <real_expr> )

      Computes the sine of its argument; the argument should be expressed in radians.
    `),
    url: `${sf}/sin`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sinh',
    description: trim(`
      SINH( <real_expr> )

      Computes the hyperbolic sine of its argument.
    `),
    url: `${sf}/sinh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sqrt',
    description: trim(`
      SQRT( <real_expr> )

      Returns the square root of a non-negative numeric expression.
    `),
    url: `${sf}/sqrt`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'square',
    description: trim(`
      SQUARE( <real_expr> )

      Returns the square of a numeric expression (i.e., the expression multiplied by itself).
    `),
    url: `${sf}/square`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'tan',
    description: trim(`
      TAN( <real_expr> )

      Computes the tangent of its argument; the argument should be expressed in radians.
    `),
    url: `${sf}/tan`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'tanh',
    description: trim(`
      TANH( <real_expr> )

      Computes the hyperbolic tangent of its argument.
    `),
    url: `${sf}/tanh`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'trunc',
    description: trim(`
      TRUNC( <input_expr> [, <scale_expr> ] )
      TRUNCATE( <input_expr> [, <scale_expr> ] )

      Rounds the input expression down to the nearest (or equal) integer closer to zero, or to the nearest equal or smaller value with the specified number of places after the decimal point.
    `),
    url: `${sf}/trunc`,
    args: [['x', 'number'], ['scale', 'number?']],
    returns: 'number',
  },
  {
    name: 'width_bucket',
    description: trim(`
      WIDTH_BUCKET( <expr>, <min_value>, <max_value>, <num_buckets> )

      Constructs equi-width histograms, in which the histogram range is divided into intervals of identical size, and returns the bucket number into which the value of an expression falls.
    `),
    url: `${sf}/width_bucket`,
    args: [
      {name: 'expr', type: 'number'},
      {name: 'min_value', type: 'number'},
      {name: 'max_value', type: 'number'},
      {name: 'num_buckets', type: 'number'},
    ],
    returns: 'number',
  },

  // ============================================================================
  // String Functions
  // https://docs.snowflake.com/en/sql-reference/functions-string
  // ============================================================================

  {
    name: 'ascii',
    description: trim(`
      ASCII( <string> )

      Returns the ASCII code for the first character of a string. If the string is empty, a value of 0 is returned.
    `),
    url: `${sf}/ascii`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'bit_length',
    description: trim(`
      BIT_LENGTH( <string_or_binary> )

      Returns the length of a string or binary value in bits.
    `),
    url: `${sf}/bit_length`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'chr',
    description: trim(`
      CHR( <integer> )
      CHAR( <integer> )

      Converts a Unicode code point (including 7-bit ASCII) into the character that matches the input Unicode.
    `),
    url: `${sf}/chr`,
    args: [['code_point', 'number']],
    returns: 'string',
  },
  {
    name: 'concat',
    description: trim(`
      CONCAT( <expr1> [ , <exprN> ... ] )

      Concatenates one or more strings, or concatenates one or more binary values. If any of the values is null, the result is also null.
    `),
    url: `${sf}/concat`,
    args: [{name: 'values', type: 'string...'}],
    returns: 'string',
  },
  {
    name: 'concat_ws',
    description: trim(`
      CONCAT_WS( <separator>, <expr1> [ , <exprN> ... ] )

      Concatenates two or more strings, or concatenates two or more binary values. A specified separator is placed between each of the values. If any of the values is null, the result is also null.
    `),
    url: `${sf}/concat_ws`,
    args: [
      {name: 'separator', type: 'string'},
      {name: 'values', type: 'string...'},
    ],
    returns: 'string',
  },
  {
    name: 'contains',
    description: trim(`
      CONTAINS( <expr1>, <expr2> )

      Returns true if expr1 contains expr2. Both expressions must be text or binary expressions.
    `),
    url: `${sf}/contains`,
    args: [['string', 'string'], ['search_string', 'string']],
    returns: 'boolean',
  },
  {
    name: 'editdistance',
    description: trim(`
      EDITDISTANCE( <string1>, <string2> [ , <max_distance> ] )

      Computes the Levenshtein distance between two input strings. It is the number of single-character insertions, deletions, or substitutions needed to convert one string to another.
    `),
    url: `${sf}/editdistance`,
    args: [
      {name: 'string1', type: 'string'},
      {name: 'string2', type: 'string'},
      {name: 'max_distance', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'endswith',
    description: trim(`
      ENDSWITH( <expr1>, <expr2> )

      Returns TRUE if expr1 ends with expr2. Both expressions must be text or binary expressions.
    `),
    url: `${sf}/endswith`,
    args: [['string', 'string'], ['suffix', 'string']],
    returns: 'boolean',
  },
  {
    name: 'initcap',
    description: trim(`
      INITCAP( <expr> [, <delimiters> ] )

      Returns the input string with the first letter of each word in uppercase and the subsequent letters in lowercase.
    `),
    url: `${sf}/initcap`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'delimiters', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'insert',
    description: trim(`
      INSERT( <base_expr>, <position>, <length>, <insert_expr> )

      Replaces a substring of the specified length, starting at the specified position, with a new string or binary value.
    `),
    url: `${sf}/insert`,
    args: [
      {name: 'base_expr', type: 'string'},
      {name: 'position', type: 'number'},
      {name: 'length', type: 'number'},
      {name: 'insert_expr', type: 'string'},
    ],
    returns: 'string',
  },
  {
    name: 'left',
    description: trim(`
      LEFT( <string_expr>, <length_expr> )

      Returns a leftmost substring of its input.
    `),
    url: `${sf}/left`,
    args: [['string', 'string'], ['length', 'number']],
    returns: 'string',
  },
  {
    name: 'length',
    description: trim(`
      LENGTH( <string_or_binary> )
      LEN( <string_or_binary> )

      Returns the length of an input string or binary value. For strings, the length is the number of characters, and UTF-8 characters are counted as a single character. For binary, the length is the number of bytes.
    `),
    url: `${sf}/length`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'lower',
    description: trim(`
      LOWER( <expr> )

      Returns the input string with all characters converted to lowercase.
    `),
    url: `${sf}/lower`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'lpad',
    description: trim(`
      LPAD( <base>, <length_expr> [, <pad>] )

      Left-pads a string with characters from another string, or left-pads a binary value with bytes from another binary value.
    `),
    url: `${sf}/lpad`,
    args: [
      {name: 'base', type: 'string'},
      {name: 'length', type: 'number'},
      {name: 'pad', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'ltrim',
    description: trim(`
      LTRIM( <expr> [, <characters> ] )

      Removes leading characters, including whitespace, from a string.
    `),
    url: `${sf}/ltrim`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'characters', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'octet_length',
    description: trim(`
      OCTET_LENGTH( <string_or_binary> )

      Returns the length of a string or binary value in bytes.
    `),
    url: `${sf}/octet_length`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'position',
    description: trim(`
      POSITION( <expr1> IN <expr2> [ FROM <position> ] )
      POSITION( <expr1>, <expr2> [, <position> ] )

      Searches for the first occurrence of the first argument in the second argument and, if successful, returns the position (1-based) of the first argument in the second argument.
    `),
    url: `${sf}/position`,
    args: [
      {name: 'search_string', type: 'string'},
      {name: 'string', type: 'string'},
      {name: 'position', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'charindex',
    description: trim(`
      CHARINDEX( <expr1>, <expr2> [, <position> ] )

      Searches for the first occurrence of the first argument in the second argument and, if successful, returns the position (1-based) of the first argument in the second argument. Alias for POSITION.
    `),
    url: `${sf}/charindex`,
    args: [
      {name: 'search_string', type: 'string'},
      {name: 'string', type: 'string'},
      {name: 'position', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'repeat',
    description: trim(`
      REPEAT( <input>, <n> )

      Builds a string by repeating the input for the specified number of times.
    `),
    url: `${sf}/repeat`,
    args: [['input', 'string'], ['n', 'number']],
    returns: 'string',
  },
  {
    name: 'replace',
    description: trim(`
      REPLACE( <subject>, <pattern> [, <replacement> ] )

      Removes all occurrences of a specified substring, and optionally replaces them with another string.
    `),
    url: `${sf}/replace`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'replacement', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'reverse',
    description: trim(`
      REVERSE( <subject> )

      Reverses the order of characters in a string, or of bytes in a binary value.
    `),
    url: `${sf}/reverse`,
    args: [['subject', 'string']],
    returns: 'string',
  },
  {
    name: 'right',
    description: trim(`
      RIGHT( <string_expr>, <length_expr> )

      Returns a rightmost substring of its input.
    `),
    url: `${sf}/right`,
    args: [['string', 'string'], ['length', 'number']],
    returns: 'string',
  },
  {
    name: 'rpad',
    description: trim(`
      RPAD( <base>, <length_expr> [, <pad>] )

      Right-pads a string with characters from another string, or right-pads a binary value with bytes from another binary value.
    `),
    url: `${sf}/rpad`,
    args: [
      {name: 'base', type: 'string'},
      {name: 'length', type: 'number'},
      {name: 'pad', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'rtrim',
    description: trim(`
      RTRIM( <expr> [, <characters> ] )

      Removes trailing characters, including whitespace, from a string.
    `),
    url: `${sf}/rtrim`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'characters', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'soundex',
    description: trim(`
      SOUNDEX( <varchar_expr> )

      Returns a string that contains a phonetic representation of the input string.
    `),
    url: `${sf}/soundex`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'space',
    description: trim(`
      SPACE( <n> )

      Returns a string consisting of the specified number of blank spaces.
    `),
    url: `${sf}/space`,
    args: [['n', 'number']],
    returns: 'string',
  },
  {
    name: 'split',
    description: trim(`
      SPLIT( <string>, <delimiter> )

      Splits a given string with a given separator and returns the result in an array of strings.
    `),
    url: `${sf}/split`,
    args: [['string', 'string'], ['delimiter', 'string']],
    returns: 'array',
  },
  {
    name: 'split_part',
    description: trim(`
      SPLIT_PART( <string>, <delimiter>, <part_number> )

      Splits a given string at a specified character or substring (the delimiter) and returns the requested part.
    `),
    url: `${sf}/split_part`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'delimiter', type: 'string'},
      {name: 'part_number', type: 'number'},
    ],
    returns: 'string',
  },
  {
    name: 'startswith',
    description: trim(`
      STARTSWITH( <expr1>, <expr2> )

      Returns TRUE if expr1 starts with expr2. Both expressions must be text or binary expressions.
    `),
    url: `${sf}/startswith`,
    args: [['string', 'string'], ['prefix', 'string']],
    returns: 'boolean',
  },
  {
    name: 'substr',
    description: trim(`
      SUBSTR( <base_expr>, <start_expr> [, <length_expr>] )
      SUBSTRING( <base_expr>, <start_expr> [, <length_expr>] )

      Returns the portion of the string or binary value from base_expr, starting from the character/byte specified by start_expr, with optionally limited length.
    `),
    url: `${sf}/substr`,
    args: [
      {name: 'base_expr', type: 'string'},
      {name: 'start_expr', type: 'number'},
      {name: 'length_expr', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'translate',
    description: trim(`
      TRANSLATE( <subject>, <sourceAlphabet>, <targetAlphabet> )

      Translates string from one alphabet to another.
    `),
    url: `${sf}/translate`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'source_alphabet', type: 'string'},
      {name: 'target_alphabet', type: 'string'},
    ],
    returns: 'string',
  },
  {
    name: 'trim',
    description: trim(`
      TRIM( <expr> [, <characters> ] )

      Removes leading and trailing characters from a string.
    `),
    url: `${sf}/trim`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'characters', type: 'string?'},
    ],
    returns: 'string',
  },
  {
    name: 'unicode',
    description: trim(`
      UNICODE( <string> )

      Returns the Unicode code point for the first character of the input string.
    `),
    url: `${sf}/unicode`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'upper',
    description: trim(`
      UPPER( <expr> )

      Returns the input string with all characters converted to uppercase.
    `),
    url: `${sf}/upper`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'uuid_string',
    description: trim(`
      UUID_STRING( [ <uuid> | <string> ] )

      Generates either a version 4 (random) or version 5 (named) RFC 4122-compliant UUID as a formatted string.
    `),
    url: `${sf}/uuid_string`,
    args: [{name: 'input', type: 'string?'}],
    returns: 'string',
  },

  // Regular Expression Functions
  {
    name: 'regexp_count',
    description: trim(`
      REGEXP_COUNT( <subject>, <pattern> [, <position> [, <parameters> ]] )

      Returns the number of times that a pattern occurs in a string.
    `),
    url: `${sf}/regexp_count`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'position', type: 'number?'},
      {name: 'parameters', type: 'string?'},
    ],
    returns: 'number',
  },
  {
    name: 'regexp_instr',
    description: trim(`
      REGEXP_INSTR( <subject>, <pattern> [, <position> [, <occurrence> [, <option> [, <parameters> [, <group_num> ]]]]] )

      Returns the position of the specified occurrence of the regular expression pattern in the string subject.
    `),
    url: `${sf}/regexp_instr`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'position', type: 'number?'},
      {name: 'occurrence', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'regexp_like',
    description: trim(`
      REGEXP_LIKE( <subject>, <pattern> [, <parameters> ] )

      Returns true if the subject matches the specified pattern. Both inputs must be text expressions.
    `),
    url: `${sf}/regexp_like`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'parameters', type: 'string?'},
    ],
    returns: 'boolean',
  },
  {
    name: 'regexp_replace',
    description: trim(`
      REGEXP_REPLACE( <subject>, <pattern> [, <replacement> [, <position> [, <occurrence> [, <parameters> ]]]] )

      Returns the subject with the specified pattern (or all occurrences of the pattern) either removed or replaced by a replacement string.
    `),
    url: `${sf}/regexp_replace`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'replacement', type: 'string?'},
      {name: 'position', type: 'number?'},
      {name: 'occurrence', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'regexp_substr',
    description: trim(`
      REGEXP_SUBSTR( <subject>, <pattern> [, <position> [, <occurrence> [, <parameters> [, <group_num> ]]]] )

      Returns the substring that matches a regular expression within a string.
    `),
    url: `${sf}/regexp_substr`,
    args: [
      {name: 'subject', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'position', type: 'number?'},
      {name: 'occurrence', type: 'number?'},
    ],
    returns: 'string',
  },

  // Hash Functions
  {
    name: 'md5',
    description: trim(`
      MD5( <msg> )
      MD5_HEX( <msg> )

      Returns a 32-character hex-encoded string containing the 128-bit MD5 message digest.
    `),
    url: `${sf}/md5`,
    args: [['msg', 'string']],
    returns: 'string',
  },
  {
    name: 'md5_binary',
    description: trim(`
      MD5_BINARY( <msg> )

      Returns a 16-byte BINARY value containing the 128-bit MD5 message digest.
    `),
    url: `${sf}/md5_binary`,
    args: [['msg', 'string']],
    returns: 'string',
  },
  {
    name: 'sha1',
    description: trim(`
      SHA1( <msg> )
      SHA1_HEX( <msg> )

      Returns a 40-character hex-encoded string containing the 160-bit SHA-1 message digest.
    `),
    url: `${sf}/sha1`,
    args: [['msg', 'string']],
    returns: 'string',
  },
  {
    name: 'sha1_binary',
    description: trim(`
      SHA1_BINARY( <msg> )

      Returns a 20-byte BINARY value containing the 160-bit SHA-1 message digest.
    `),
    url: `${sf}/sha1_binary`,
    args: [['msg', 'string']],
    returns: 'string',
  },
  {
    name: 'sha2',
    description: trim(`
      SHA2( <msg> [, <digest_size>] )
      SHA2_HEX( <msg> [, <digest_size>] )

      Returns a hex-encoded string containing the SHA-2 message digest.
    `),
    url: `${sf}/sha2`,
    args: [
      {name: 'msg', type: 'string'},
      {name: 'digest_size', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'sha2_binary',
    description: trim(`
      SHA2_BINARY( <msg> [, <digest_size>] )

      Returns a BINARY value containing the SHA-2 message digest.
    `),
    url: `${sf}/sha2_binary`,
    args: [
      {name: 'msg', type: 'string'},
      {name: 'digest_size', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'hash',
    description: trim(`
      HASH( <expr> [, <expr2> ... ] )

      Returns a signed 64-bit hash value. Note that HASH is not a cryptographic hash function.
    `),
    url: `${sf}/hash`,
    args: [{name: 'expressions', type: 'any...'}],
    returns: 'number',
  },

  // ============================================================================
  // Date & Time Functions
  // https://docs.snowflake.com/en/sql-reference/functions-date-time
  // ============================================================================

  {
    name: 'add_months',
    description: trim(`
      ADD_MONTHS( <date_or_timestamp_expr>, <num_months_expr> )

      Adds or subtracts a specified number of months to a date or timestamp.
    `),
    url: `${sf}/add_months`,
    args: [
      {name: 'date_expr', type: ['date', 'timestamp']},
      {name: 'num_months', type: 'number'},
    ],
    returns: 'date',
  },
  {
    name: 'date_from_parts',
    description: trim(`
      DATE_FROM_PARTS( <year>, <month>, <day> )

      Creates a date from individual numeric components that represent the year, month, and day of the month.
    `),
    url: `${sf}/date_from_parts`,
    args: [
      {name: 'year', type: 'number'},
      {name: 'month', type: 'number'},
      {name: 'day', type: 'number'},
    ],
    returns: 'date',
  },
  {
    name: 'date_part',
    description: trim(`
      DATE_PART( <date_or_time_part>, <date_or_time_expr> )

      Extracts the specified date or time part from a date, time, or timestamp.
    `),
    url: `${sf}/date_part`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'date_expr', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'dateadd',
    description: trim(`
      DATEADD( <date_or_time_part>, <value>, <date_or_time_expr> )

      Adds the specified value for the specified date or time part to a date, time, or timestamp.
    `),
    url: `${sf}/dateadd`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'value', type: 'number'},
      {name: 'date_expr', type: ['date', 'timestamp']},
    ],
    returns: 'timestamp',
  },
  {
    name: 'datediff',
    description: trim(`
      DATEDIFF( <date_or_time_part>, <date_or_time_expr1>, <date_or_time_expr2> )

      Calculates the difference between two date, time, or timestamp expressions based on the specified date or time part.
    `),
    url: `${sf}/datediff`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'date_expr1', type: ['date', 'timestamp']},
      {name: 'date_expr2', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'dayname',
    description: trim(`
      DAYNAME( <date_or_timestamp_expr> )

      Extracts the three-letter day-of-week name from the specified date or timestamp.
    `),
    url: `${sf}/dayname`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'string',
  },
  {
    name: 'last_day',
    description: trim(`
      LAST_DAY( <date_or_time_expr> [, <date_part> ] )

      Returns the last day of the specified date part for a date or timestamp.
    `),
    url: `${sf}/last_day`,
    args: [
      {name: 'date_expr', type: ['date', 'timestamp']},
      {name: 'date_part', type: 'string?'},
    ],
    returns: 'date',
  },
  {
    name: 'monthname',
    description: trim(`
      MONTHNAME( <date_or_timestamp_expr> )

      Extracts the three-letter month name from the specified date or timestamp.
    `),
    url: `${sf}/monthname`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'string',
  },
  {
    name: 'months_between',
    description: trim(`
      MONTHS_BETWEEN( <date_expr1>, <date_expr2> )

      Returns the number of months between two DATE or TIMESTAMP values.
    `),
    url: `${sf}/months_between`,
    args: [
      {name: 'date_expr1', type: ['date', 'timestamp']},
      {name: 'date_expr2', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'next_day',
    description: trim(`
      NEXT_DAY( <date_or_timestamp_expr>, <dow_string> )

      Returns the date of the first specified day of the week that occurs after the input date.
    `),
    url: `${sf}/next_day`,
    args: [
      {name: 'date_expr', type: ['date', 'timestamp']},
      {name: 'dow_string', type: 'string'},
    ],
    returns: 'date',
  },
  {
    name: 'previous_day',
    description: trim(`
      PREVIOUS_DAY( <date_or_timestamp_expr>, <dow_string> )

      Returns the date of the first specified day of the week that occurs before the input date.
    `),
    url: `${sf}/previous_day`,
    args: [
      {name: 'date_expr', type: ['date', 'timestamp']},
      {name: 'dow_string', type: 'string'},
    ],
    returns: 'date',
  },
  {
    name: 'time_from_parts',
    description: trim(`
      TIME_FROM_PARTS( <hour>, <minute>, <second> [, <nanosecond>] )

      Creates a time from individual numeric components.
    `),
    url: `${sf}/time_from_parts`,
    args: [
      {name: 'hour', type: 'number'},
      {name: 'minute', type: 'number'},
      {name: 'second', type: 'number'},
      {name: 'nanosecond', type: 'number?'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'time_slice',
    description: trim(`
      TIME_SLICE( <date_or_time_expr>, <slice_length>, <date_or_time_part> [, <start_or_end> ] )

      Calculates the beginning or end of a time slice, which is a period of time.
    `),
    url: `${sf}/time_slice`,
    args: [
      {name: 'date_or_time_expr', type: ['date', 'timestamp']},
      {name: 'slice_length', type: 'number'},
      {name: 'date_or_time_part', type: 'string'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'timestamp_from_parts',
    description: trim(`
      TIMESTAMP_FROM_PARTS( <year>, <month>, <day>, <hour>, <minute>, <second> [, <nanosecond>] [, <time_zone>] )

      Creates a timestamp from individual numeric components.
    `),
    url: `${sf}/timestamp_from_parts`,
    args: [
      {name: 'year', type: 'number'},
      {name: 'month', type: 'number'},
      {name: 'day', type: 'number'},
      {name: 'hour', type: 'number'},
      {name: 'minute', type: 'number'},
      {name: 'second', type: 'number'},
      {name: 'nanosecond', type: 'number?'},
    ],
    returns: 'timestamp',
  },
  {
    name: 'convert_timezone',
    description: trim(`
      CONVERT_TIMEZONE( [<source_tz>,] <target_tz>, <source_timestamp_ntz> )

      Converts a timestamp to another time zone.
    `),
    url: `${sf}/convert_timezone`,
    args: [
      {name: 'source_tz', type: 'string?'},
      {name: 'target_tz', type: 'string'},
      {name: 'source_timestamp', type: 'timestamp'},
    ],
    returns: 'timestamp',
  },

  // Date extraction functions (commonly used as aliases for DATE_PART)
  {
    name: 'year',
    description: trim(`
      YEAR( <date_or_timestamp_expr> )

      Extracts the year from a date or timestamp. Equivalent to DATE_PART('year', ...).
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'month',
    description: trim(`
      MONTH( <date_or_timestamp_expr> )

      Extracts the month from a date or timestamp. Equivalent to DATE_PART('month', ...).
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'day',
    description: trim(`
      DAY( <date_or_timestamp_expr> )
      DAYOFMONTH( <date_or_timestamp_expr> )

      Extracts the day of month from a date or timestamp. Equivalent to DATE_PART('day', ...).
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'dayofweek',
    description: trim(`
      DAYOFWEEK( <date_or_timestamp_expr> )

      Extracts the day of the week from a date or timestamp.
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'dayofyear',
    description: trim(`
      DAYOFYEAR( <date_or_timestamp_expr> )

      Extracts the day of the year from a date or timestamp.
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'week',
    description: trim(`
      WEEK( <date_or_timestamp_expr> )
      WEEKOFYEAR( <date_or_timestamp_expr> )

      Extracts the week of the year from a date or timestamp.
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'quarter',
    description: trim(`
      QUARTER( <date_or_timestamp_expr> )

      Extracts the quarter from a date or timestamp (1-4).
    `),
    url: `${sf}/year`,
    args: [{name: 'date_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'hour',
    description: trim(`
      HOUR( <time_or_timestamp_expr> )

      Extracts the hour (0-23) from a time or timestamp.
    `),
    url: `${sf}/hour-minute-second`,
    args: [{name: 'time_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'minute',
    description: trim(`
      MINUTE( <time_or_timestamp_expr> )

      Extracts the minute (0-59) from a time or timestamp.
    `),
    url: `${sf}/hour-minute-second`,
    args: [{name: 'time_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },
  {
    name: 'second',
    description: trim(`
      SECOND( <time_or_timestamp_expr> )

      Extracts the second (0-59) from a time or timestamp.
    `),
    url: `${sf}/hour-minute-second`,
    args: [{name: 'time_expr', type: ['date', 'timestamp']}],
    returns: 'number',
  },

  // ============================================================================
  // Conditional Functions
  // https://docs.snowflake.com/en/sql-reference/expressions-conditional
  // ============================================================================

  {
    name: 'coalesce',
    description: trim(`
      COALESCE( <expr1>, <expr2> [, <exprN> ... ] )

      Returns the first non-NULL expression among its arguments, or NULL if all its arguments are NULL.
    `),
    url: `${sf}/coalesce`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'decode',
    description: trim(`
      DECODE( <expr>, <search1>, <result1> [, <search2>, <result2> ... ] [, <default> ] )

      Compares the select expression to each search expression in order. As soon as a search expression matches the selection expression, the corresponding result expression is returned.
    `),
    url: `${sf}/decode`,
    args: [
      {name: 'expr', type: 'any'},
      {name: 'search1', type: 'any'},
      {name: 'result1', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'equal_null',
    description: trim(`
      EQUAL_NULL( <expr1>, <expr2> )

      Compares whether two expressions are equal. The function is NULL-safe, meaning it treats NULLs as known values for comparing equality.
    `),
    url: `${sf}/equal_null`,
    args: [
      {name: 'expr1', type: 'any'},
      {name: 'expr2', type: 'any'},
    ],
    returns: 'boolean',
  },
  {
    name: 'greatest',
    description: trim(`
      GREATEST( <expr1> [, <expr2> ... ] )

      Returns the largest value from a list of expressions. NULL values are ignored. If all arguments are NULL, the result is NULL.
    `),
    url: `${sf}/greatest`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'iff',
    description: trim(`
      IFF( <condition>, <expr1>, <expr2> )

      Single-level if-then-else expression. Similar to CASE, but only allows a single condition.
    `),
    url: `${sf}/iff`,
    args: [
      {name: 'condition', type: 'boolean'},
      {name: 'true_value', type: 'T'},
      {name: 'false_value', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'ifnull',
    description: trim(`
      IFNULL( <expr1>, <expr2> )

      If expr1 is NULL, returns expr2; otherwise, returns expr1.
    `),
    url: `${sf}/ifnull`,
    args: [
      {name: 'expr1', type: 'T'},
      {name: 'expr2', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'least',
    description: trim(`
      LEAST( <expr1> [, <expr2> ... ] )

      Returns the smallest value from a list of expressions. NULL values are ignored. If all arguments are NULL, the result is NULL.
    `),
    url: `${sf}/least`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'nullif',
    description: trim(`
      NULLIF( <expr1>, <expr2> )

      Returns NULL if expr1 is equal to expr2, otherwise returns expr1.
    `),
    url: `${sf}/nullif`,
    args: [
      {name: 'expr1', type: 'T'},
      {name: 'expr2', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'nullifzero',
    description: trim(`
      NULLIFZERO( <expr> )

      Returns NULL if the argument evaluates to 0; otherwise, returns the argument.
    `),
    url: `${sf}/nullifzero`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'nvl',
    description: trim(`
      NVL( <expr1>, <expr2> )

      If expr1 is NULL, returns expr2; otherwise, returns expr1. Alias for IFNULL.
    `),
    url: `${sf}/nvl`,
    args: [
      {name: 'expr1', type: 'T'},
      {name: 'expr2', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'nvl2',
    description: trim(`
      NVL2( <expr1>, <expr2>, <expr3> )

      Returns expr2 if expr1 is not NULL, otherwise returns expr3.
    `),
    url: `${sf}/nvl2`,
    args: [
      {name: 'expr1', type: 'any'},
      {name: 'expr2', type: 'T'},
      {name: 'expr3', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'zeroifnull',
    description: trim(`
      ZEROIFNULL( <expr> )

      Returns 0 if the argument is NULL; otherwise, returns the argument.
    `),
    url: `${sf}/zeroifnull`,
    args: [{name: 'expr', type: 'number'}],
    returns: 'number',
  },

  // Boolean functions
  {
    name: 'booland',
    description: trim(`
      BOOLAND( <expr1>, <expr2> )

      Computes the Boolean AND of two numeric expressions.
    `),
    url: `${sf}/booland`,
    args: [
      {name: 'expr1', type: 'boolean'},
      {name: 'expr2', type: 'boolean'},
    ],
    returns: 'boolean',
  },
  {
    name: 'boolnot',
    description: trim(`
      BOOLNOT( <expr> )

      Computes the Boolean NOT of a numeric expression.
    `),
    url: `${sf}/boolnot`,
    args: [{name: 'expr', type: 'boolean'}],
    returns: 'boolean',
  },
  {
    name: 'boolor',
    description: trim(`
      BOOLOR( <expr1>, <expr2> )

      Computes the Boolean OR of two numeric expressions.
    `),
    url: `${sf}/boolor`,
    args: [
      {name: 'expr1', type: 'boolean'},
      {name: 'expr2', type: 'boolean'},
    ],
    returns: 'boolean',
  },
  {
    name: 'boolxor',
    description: trim(`
      BOOLXOR( <expr1>, <expr2> )

      Computes the Boolean XOR of two numeric expressions.
    `),
    url: `${sf}/boolxor`,
    args: [
      {name: 'expr1', type: 'boolean'},
      {name: 'expr2', type: 'boolean'},
    ],
    returns: 'boolean',
  },

  // ============================================================================
  // Utility Functions
  // ============================================================================

  {
    name: 'typeof',
    description: trim(`
      TYPEOF( <expr> )

      Reports the type of a value stored in a VARIANT column. The type is returned as a string.
    `),
    url: `${sf}/typeof`,
    args: [{name: 'expr', type: 'any'}],
    returns: 'string',
  },

  // ============================================================================
  // Date/Time Functions (additional)
  // ============================================================================

  {
    name: 'date_trunc',
    description: trim(`
      DATE_TRUNC( <date_or_time_part>, <date_or_time_expr> )

      Truncates a DATE, TIME, or TIMESTAMP to the specified precision.
    `),
    url: `${sf}/date_trunc`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'date_expr', type: ['date', 'timestamp']},
    ],
    returns: 'timestamp',
    sqlTemplate: 'DATE_TRUNC(${part}, ${date_expr})',
  },
  {
    name: 'current_date',
    description: trim(`
      CURRENT_DATE

      Returns the current date of the system.
    `),
    url: `${sf}/current_date`,
    args: [],
    returns: 'date',
  },
  {
    name: 'current_time',
    description: trim(`
      CURRENT_TIME

      Returns the current time of the system.
    `),
    url: `${sf}/current_time`,
    args: [],
    returns: 'timestamp',
  },
  {
    name: 'current_timestamp',
    description: trim(`
      CURRENT_TIMESTAMP

      Returns the current timestamp of the system.
    `),
    url: `${sf}/current_timestamp`,
    args: [],
    returns: 'timestamp',
  },
]
