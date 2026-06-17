// DuckDB SQL function definitions
// These get converted to Malloy blueprints in functions.ts
//
// Documentation is copied verbatim from:
// https://duckdb.org/docs/stable/sql/functions/

import type {FunctionDef} from './functionTypes.ts'

import {inferTimeOrdinal, inferGrain} from './temporalMetadata.ts'
import {trimIndentation} from './util.ts'

const duck = 'https://duckdb.org/docs/stable/sql/functions'
const duckJson = 'https://duckdb.org/docs/stable/data/json'
const duckList = 'https://duckdb.org/docs/stable/sql/functions/list'
const duckMap = 'https://duckdb.org/docs/stable/sql/functions/map'
const duckStruct = 'https://duckdb.org/docs/stable/sql/functions/struct'

// Helper to trim and dedent multiline strings
const trim = trimIndentation

function jsonFunction(name: string, args: FunctionDef['args'], returns: string, description: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return {
    name,
    description: trim(description),
    url: opts.url || `${duckJson}/json_functions`,
    args,
    returns,
    ...opts,
  }
}

function nestedFunction(name: string, args: FunctionDef['args'], returns: string, description: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return {
    name,
    description: trim(description),
    url: opts.url || duckList,
    args,
    returns,
    ...opts,
  }
}

function textFunction(name: string, args: FunctionDef['args'], returns: string, description: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return {
    name,
    description: trim(description),
    url: opts.url || `${duck}/text`,
    args,
    returns,
    ...opts,
  }
}

export const duckDbFunctions: FunctionDef[] = [
  // ============================================================================
  // Window Functions
  // https://duckdb.org/docs/stable/sql/functions/window_functions.html
  // ============================================================================
  {
    name: 'row_number',
    description: trim('row_number() returns the current row number within the window partition.'),
    url: `${duck}/window_functions.html#row_number`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'rank',
    description: trim('rank() returns the rank of the current row with gaps for ties.'),
    url: `${duck}/window_functions.html#rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'dense_rank',
    description: trim('dense_rank() returns the rank of the current row without gaps.'),
    url: `${duck}/window_functions.html#dense_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'ntile',
    description: trim('ntile(num_buckets) returns the bucket number for the current row.'),
    url: `${duck}/window_functions.html#ntilenum_buckets-order-by-ordering`,
    args: [{name: 'num_buckets', type: 'number'}],
    returns: 'number',
    window: true,
  },
  {
    name: 'lag',
    description: trim('lag(expr, offset, default) returns a prior row value within the window partition.'),
    url: `${duck}/window_functions.html#lagexpr-offset-default-order-by-ordering-ignore-nulls`,
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
    description: trim('lead(expr, offset, default) returns a following row value within the window partition.'),
    url: `${duck}/window_functions.html#leadexpr-offset-default-order-by-ordering-ignore-nulls`,
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
    description: trim('first_value(expr) returns the first value in the window frame.'),
    url: `${duck}/window_functions.html#first_valueexpr-order-by-ordering-ignore-nulls`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'last_value',
    description: trim('last_value(expr) returns the last value in the window frame.'),
    url: `${duck}/window_functions.html#last_valueexpr-order-by-ordering-ignore-nulls`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'nth_value',
    description: trim('nth_value(expr, nth) returns the nth value in the window frame.'),
    url: `${duck}/window_functions.html#nth_valueexpr-nth-order-by-ordering-ignore-nulls`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'nth', type: 'number'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'percent_rank',
    description: trim('percent_rank() returns the relative rank of the current row.'),
    url: `${duck}/window_functions.html#percent_rank-order-by-ordering`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'cume_dist',
    description: trim('cume_dist() returns the cumulative distribution value for the current row.'),
    url: `${duck}/window_functions.html#cume_dist-order-by-ordering`,
    args: [],
    returns: 'number',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // https://duckdb.org/docs/stable/sql/functions/aggregates.html
  // ============================================================================

  {
    name: 'any_value',
    description: trim(`
      any_value(arg)

      Returns the first non-null value from arg. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#any_valuearg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'arg_max',
    description: trim(`
      arg_max(arg, val)

      Finds the row with the maximum val and calculates the arg expression at that row. Rows where the value of the arg or val expression is NULL are ignored. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#arg_maxarg-val`,
    args: [
      {name: 'arg', type: 'T', description: 'The value to return.'},
      {name: 'val', type: 'any', description: 'The value used to determine the maximum.'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'arg_min',
    description: trim(`
      arg_min(arg, val)

      Finds the row with the minimum val and calculates the arg expression at that row. Rows where the value of the arg or val expression is NULL are ignored. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#arg_minarg-val`,
    args: [
      {name: 'arg', type: 'T', description: 'The value to return.'},
      {name: 'val', type: 'any', description: 'The value used to determine the minimum.'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'avg',
    description: trim(`
      avg(arg)

      Calculates the average of all non-null values in arg. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#avgarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_and',
    description: trim(`
      bit_and(arg)

      Returns the bitwise AND of all bits in a given expression.
    `),
    url: `${duck}/aggregates#bit_andarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_or',
    description: trim(`
      bit_or(arg)

      Returns the bitwise OR of all bits in a given expression.
    `),
    url: `${duck}/aggregates#bit_orarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bit_xor',
    description: trim(`
      bit_xor(arg)

      Returns the bitwise XOR of all bits in a given expression.
    `),
    url: `${duck}/aggregates#bit_xorarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'bool_and',
    description: trim(`
      bool_and(arg)

      Returns true if every input value is true, otherwise false.
    `),
    url: `${duck}/aggregates#bool_andarg`,
    args: [{name: 'arg', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'bool_or',
    description: trim(`
      bool_or(arg)

      Returns true if any input value is true, otherwise false.
    `),
    url: `${duck}/aggregates#bool_orarg`,
    args: [{name: 'arg', type: 'boolean'}],
    returns: 'boolean',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'count',
    description: trim(`
      count(arg)

      Returns the number of rows where arg is not NULL.
    `),
    url: `${duck}/aggregates#countarg`,
    args: [{name: 'arg', type: 'any?'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'first',
    description: trim(`
      first(arg)

      Returns the first value (null or non-null) from arg. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#firstarg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'last',
    description: trim(`
      last(arg)

      Returns the last value of a column. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#lastarg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'list',
    description: trim(`
      list(arg)

      Returns a LIST containing all the values of a column. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#listarg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'array',
    aggregate: true,
  },
  {
    name: 'max',
    description: trim(`
      max(arg)

      Returns the maximum value present in arg.
    `),
    url: `${duck}/aggregates#maxarg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'min',
    description: trim(`
      min(arg)

      Returns the minimum value present in arg.
    `),
    url: `${duck}/aggregates#minarg`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'product',
    description: trim(`
      product(arg)

      Calculates the product of all non-null values in arg. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#productarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'string_agg',
    description: trim(`
      string_agg(arg, sep)

      Concatenates the column string values with a separator. This function is affected by ordering.
      If no separator is provided, defaults to comma.
    `),
    url: `${duck}/aggregates#string_aggarg-sep`,
    args: [
      {name: 'arg', type: 'string'},
      {name: 'sep', type: 'string?'},
    ],
    returns: 'string',
    aggregate: true,
  },
  {
    name: 'sum',
    description: trim(`
      sum(arg)

      Calculates the sum of all non-null values in arg.
    `),
    url: `${duck}/aggregates#sumarg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Statistical Aggregate Functions
  // https://duckdb.org/docs/stable/sql/functions/aggregates.html#statistical-aggregates
  // ============================================================================

  {
    name: 'corr',
    description: trim(`
      corr(y, x)

      The correlation coefficient.
    `),
    url: `${duck}/aggregates#corry-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_pop',
    description: trim(`
      covar_pop(y, x)

      The population covariance, which does not include bias correction.
    `),
    url: `${duck}/aggregates#covar_popy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'covar_samp',
    description: trim(`
      covar_samp(y, x)

      The sample covariance, which includes Bessel's bias correction.
    `),
    url: `${duck}/aggregates#covar_sampy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'entropy',
    description: trim(`
      entropy(x)

      The log-2 entropy of count input-values.
    `),
    url: `${duck}/aggregates#entropyx`,
    args: [{name: 'x', type: 'any'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'kurtosis',
    description: trim(`
      kurtosis(x)

      The excess kurtosis (Fisher's definition) with bias correction according to the sample size.
    `),
    url: `${duck}/aggregates#kurtosisx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'mad',
    description: trim(`
      mad(x)

      The median absolute deviation. Temporal types return a positive INTERVAL.
    `),
    url: `${duck}/aggregates#madx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'median',
    description: trim(`
      median(x)

      The middle value of the set. For even value counts, quantitative values are averaged and ordinal values return the lower value.
    `),
    url: `${duck}/aggregates#medianx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'mode',
    description: trim(`
      mode(x)

      The most frequent value. This function is affected by ordering.
    `),
    url: `${duck}/aggregates#modex`,
    args: [{name: 'x', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'quantile_cont',
    description: trim(`
      quantile_cont(x, pos)

      The interpolated pos-quantile of x for 0 <= pos <= 1.
    `),
    url: `${duck}/aggregates#quantile_contx-pos`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'pos', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'quantile_disc',
    description: trim(`
      quantile_disc(x, pos)

      The discrete pos-quantile of x for 0 <= pos <= 1.
    `),
    url: `${duck}/aggregates#quantile_discx-pos`,
    args: [
      {name: 'x', type: 'T'},
      {name: 'pos', type: 'number'},
    ],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'regr_avgx',
    description: trim(`
      regr_avgx(y, x)

      The average of the independent variable for non-NULL pairs.
    `),
    url: `${duck}/aggregates#regr_avgxy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_avgy',
    description: trim(`
      regr_avgy(y, x)

      The average of the dependent variable for non-NULL pairs.
    `),
    url: `${duck}/aggregates#regr_avgyy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_count',
    description: trim(`
      regr_count(y, x)

      The number of non-NULL pairs.
    `),
    url: `${duck}/aggregates#regr_county-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_intercept',
    description: trim(`
      regr_intercept(y, x)

      The intercept of the univariate linear regression line.
    `),
    url: `${duck}/aggregates#regr_intercepty-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_r2',
    description: trim(`
      regr_r2(y, x)

      The squared Pearson correlation coefficient between y and x.
    `),
    url: `${duck}/aggregates#regr_r2y-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_slope',
    description: trim(`
      regr_slope(y, x)

      The slope of the linear regression line.
    `),
    url: `${duck}/aggregates#regr_slopey-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_sxx',
    description: trim(`
      regr_sxx(y, x)

      The sample variance of the independent variable for non-NULL pairs.
    `),
    url: `${duck}/aggregates#regr_sxxy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_sxy',
    description: trim(`
      regr_sxy(y, x)

      The sample covariance, which includes Bessel's bias correction.
    `),
    url: `${duck}/aggregates#regr_sxyy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'regr_syy',
    description: trim(`
      regr_syy(y, x)

      The sample variance of the dependent variable for non-NULL pairs.
    `),
    url: `${duck}/aggregates#regr_syyy-x`,
    args: [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'skewness',
    description: trim(`
      skewness(x)

      The skewness.
    `),
    url: `${duck}/aggregates#skewnessx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_pop',
    description: trim(`
      stddev_pop(x)

      The population standard deviation.
    `),
    url: `${duck}/aggregates#stddev_popx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'stddev_samp',
    description: trim(`
      stddev_samp(x)

      The sample standard deviation.
    `),
    url: `${duck}/aggregates#stddev_sampx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_pop',
    description: trim(`
      var_pop(x)

      The population variance, which does not include bias correction.
    `),
    url: `${duck}/aggregates#var_popx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'var_samp',
    description: trim(`
      var_samp(x)

      The sample variance, which includes Bessel's bias correction.
    `),
    url: `${duck}/aggregates#var_sampx`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Approximate Aggregate Functions
  // https://duckdb.org/docs/stable/sql/functions/aggregates.html#approximate-aggregates
  // ============================================================================

  {
    name: 'approx_count_distinct',
    description: trim(`
      approx_count_distinct(x)

      Calculates the approximate count of distinct elements using HyperLogLog.
    `),
    url: `${duck}/aggregates#approx_count_distinctx`,
    args: [{name: 'x', type: 'any'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'approx_quantile',
    description: trim(`
      approx_quantile(x, pos)

      Calculates the approximate quantile using T-Digest.
    `),
    url: `${duck}/aggregates#approx_quantilex-pos`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'pos', type: 'number'},
    ],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'reservoir_quantile',
    description: trim(`
      reservoir_quantile(x, quantile, sample_size)

      Calculates the approximate quantile using reservoir sampling, the sample size is optional and uses 8192 as a default size.
    `),
    url: `${duck}/aggregates#reservoir_quantilex-quantile-sample_size`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'quantile', type: 'number'},
      {name: 'sample_size', type: 'number?'},
    ],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Numeric Functions
  // https://duckdb.org/docs/stable/sql/functions/numeric.html
  // ============================================================================

  {
    name: 'abs',
    description: trim(`
      abs(x)

      Absolute value.
    `),
    url: `${duck}/numeric#absx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acos',
    description: trim(`
      acos(x)

      Computes the inverse cosine of x.
    `),
    url: `${duck}/numeric#acosx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'acosh',
    description: trim(`
      acosh(x)

      Computes the inverse hyperbolic cosine of x.
    `),
    url: `${duck}/numeric#acoshx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asin',
    description: trim(`
      asin(x)

      Computes the inverse sine of x.
    `),
    url: `${duck}/numeric#asinx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'asinh',
    description: trim(`
      asinh(x)

      Computes the inverse hyperbolic sine of x.
    `),
    url: `${duck}/numeric#asinhx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan',
    description: trim(`
      atan(x)

      Computes the inverse tangent of x.
    `),
    url: `${duck}/numeric#atanx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atanh',
    description: trim(`
      atanh(x)

      Computes the inverse hyperbolic tangent of x.
    `),
    url: `${duck}/numeric#atanhx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'atan2',
    description: trim(`
      atan2(y, x)

      Computes the inverse tangent of (y, x).
    `),
    url: `${duck}/numeric#atan2y-x`,
    args: [
      ['y', 'number'],
      ['x', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'bit_count',
    description: trim(`
      bit_count(x)

      Returns the number of bits that are set.
    `),
    url: `${duck}/numeric#bit_countx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cbrt',
    description: trim(`
      cbrt(x)

      Returns the cube root of the number.
    `),
    url: `${duck}/numeric#cbrtx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ceil',
    description: trim(`
      ceil(x)

      Rounds the number up.
    `),
    url: `${duck}/numeric#ceilx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ceiling',
    description: trim(`
      ceiling(x)

      Rounds the number up. Alias of ceil.
    `),
    url: `${duck}/numeric#ceilingx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cos',
    description: trim(`
      cos(x)

      Computes the cosine of x.
    `),
    url: `${duck}/numeric#cosx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'cot',
    description: trim(`
      cot(x)

      Computes the cotangent of x.
    `),
    url: `${duck}/numeric#cotx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'degrees',
    description: trim(`
      degrees(x)

      Converts radians to degrees.
    `),
    url: `${duck}/numeric#degreesx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'even',
    description: trim(`
      even(x)

      Round to next even number by rounding away from zero.
    `),
    url: `${duck}/numeric#evenx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'exp',
    description: trim(`
      exp(x)

      Computes e ** x.
    `),
    url: `${duck}/numeric#expx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'factorial',
    description: trim(`
      factorial(x)

      Computes the product of the current integer and all integers below it.
    `),
    url: `${duck}/numeric#factorialx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'floor',
    description: trim(`
      floor(x)

      Rounds the number down.
    `),
    url: `${duck}/numeric#floorx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'gamma',
    description: trim(`
      gamma(x)

      Interpolation of the factorial of x - 1. Fractional inputs are allowed.
    `),
    url: `${duck}/numeric#gammax`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'gcd',
    description: trim(`
      gcd(x, y)

      Computes the greatest common divisor of x and y.
    `),
    url: `${duck}/numeric#gcdx-y`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'greatest',
    description: trim(`
      greatest(x1, x2, ...)

      Selects the largest value.
    `),
    url: `${duck}/numeric#greatestx1-x2-`,
    args: [['values', 'T...']],
    returns: 'T',
  },
  {
    name: 'isfinite',
    description: trim(`
      isfinite(x)

      Returns true if the floating point value is finite, false otherwise.
    `),
    url: `${duck}/numeric#isfinitex`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'isinf',
    description: trim(`
      isinf(x)

      Returns true if the floating point value is infinite, false otherwise.
    `),
    url: `${duck}/numeric#isinfx`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'isnan',
    description: trim(`
      isnan(x)

      Returns true if the floating point value is not a number, false otherwise.
    `),
    url: `${duck}/numeric#isnanx`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'lcm',
    description: trim(`
      lcm(x, y)

      Computes the least common multiple of x and y.
    `),
    url: `${duck}/numeric#lcmx-y`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'least',
    description: trim(`
      least(x1, x2, ...)

      Selects the smallest value.
    `),
    url: `${duck}/numeric#leastx1-x2-`,
    args: [['values', 'T...']],
    returns: 'T',
  },
  {
    name: 'lgamma',
    description: trim(`
      lgamma(x)

      Computes the log of the gamma function.
    `),
    url: `${duck}/numeric#lgammax`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'ln',
    description: trim(`
      ln(x)

      Computes the natural logarithm of x.
    `),
    url: `${duck}/numeric#lnx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'log',
    description: trim(`
      log(x)

      Computes the base-10 logarithm of x.
    `),
    url: `${duck}/numeric#logx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'log10',
    description: trim(`
      log10(x)

      Alias of log. Computes the base-10 logarithm of x.
    `),
    url: `${duck}/numeric#log10x`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'log2',
    description: trim(`
      log2(x)

      Computes the base-2 log of x.
    `),
    url: `${duck}/numeric#log2x`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'pi',
    description: trim(`
      pi()

      Returns the value of pi.
    `),
    url: `${duck}/numeric#pi`,
    args: [],
    returns: 'number',
  },
  {
    name: 'pow',
    description: trim(`
      pow(x, y)

      Computes x to the power of y.
    `),
    url: `${duck}/numeric#powx-y`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'power',
    description: trim(`
      power(x, y)

      Alias of pow. Computes x to the power of y.
    `),
    url: `${duck}/numeric#powerx-y`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },
  {
    name: 'radians',
    description: trim(`
      radians(x)

      Converts degrees to radians.
    `),
    url: `${duck}/numeric#radiansx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'random',
    description: trim(`
      random()

      Returns a random number x in the range 0.0 <= x < 1.0.
    `),
    url: `${duck}/numeric#random`,
    args: [],
    returns: 'number',
  },
  {
    name: 'round',
    description: trim(`
      round(v, s)

      Round to s decimal places. Values s < 0 are allowed.
    `),
    url: `${duck}/numeric#roundv-numeric-s-integer`,
    args: [
      ['v', 'number'],
      ['s', 'number?'],
    ],
    returns: 'number',
  },
  {
    name: 'setseed',
    description: trim(`
      setseed(x)

      Sets the seed to be used for the random function.
    `),
    url: `${duck}/numeric#setseedx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sign',
    description: trim(`
      sign(x)

      Returns the sign of x as -1, 0 or 1.
    `),
    url: `${duck}/numeric#signx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'signbit',
    description: trim(`
      signbit(x)

      Returns whether the signbit is set or not.
    `),
    url: `${duck}/numeric#signbitx`,
    args: [['x', 'number']],
    returns: 'boolean',
  },
  {
    name: 'sin',
    description: trim(`
      sin(x)

      Computes the sin of x.
    `),
    url: `${duck}/numeric#sinx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'sqrt',
    description: trim(`
      sqrt(x)

      Returns the square root of the number.
    `),
    url: `${duck}/numeric#sqrtx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'tan',
    description: trim(`
      tan(x)

      Computes the tangent of x.
    `),
    url: `${duck}/numeric#tanx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'trunc',
    description: trim(`
      trunc(x)

      Truncates the number.
    `),
    url: `${duck}/numeric#truncx`,
    args: [['x', 'number']],
    returns: 'number',
  },
  {
    name: 'xor',
    description: trim(`
      xor(x, y)

      Bitwise XOR.
    `),
    url: `${duck}/numeric#xorx-y`,
    args: [
      ['x', 'number'],
      ['y', 'number'],
    ],
    returns: 'number',
  },

  // ============================================================================
  // Text Functions
  // https://duckdb.org/docs/stable/sql/functions/text.html
  // ============================================================================

  {
    name: 'ascii',
    description: trim(`
      ascii(string)

      Returns an integer that represents the Unicode code point of the first character of the string.
    `),
    url: `${duck}/text#asciistring`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'chr',
    description: trim(`
      chr(code_point)

      Returns a character which is corresponding the ASCII code value or Unicode code point.
    `),
    url: `${duck}/text#chrcode_point`,
    args: [['code_point', 'number']],
    returns: 'string',
  },
  {
    name: 'concat',
    description: trim(`
      concat(value, ...)

      Concatenates multiple strings or lists. NULL inputs are skipped.
    `),
    url: `${duck}/text#concatvalue-`,
    args: [['values', 'string...']],
    returns: 'string',
  },
  {
    name: 'concat_ws',
    description: trim(`
      concat_ws(separator, string, ...)

      Concatenates many strings, separated by separator. NULL inputs are skipped.
    `),
    url: `${duck}/text#concat_wsseparator-string-`,
    args: [
      {name: 'separator', type: 'string'},
      {name: 'strings', type: 'string...'},
    ],
    returns: 'string',
  },
  {
    name: 'contains',
    description: trim(`
      contains(string, search_string)

      Returns true if search_string is found within string.
    `),
    url: `${duck}/text#containsstring-search_string`,
    args: [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'ends_with',
    description: trim(`
      ends_with(string, search_string)

      Returns true if string ends with search_string.
    `),
    url: `${duck}/text#suffixstring-search_string`,
    args: [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'format',
    description: trim(`
      format(format, ...)

      Formats a string using the fmt syntax.
    `),
    url: `${duck}/text#formatformat-`,
    args: [
      {name: 'format_string', type: 'string'},
      {name: 'values', type: 'any...'},
    ],
    returns: 'string',
  },
  {
    name: 'instr',
    description: trim(`
      instr(string, search_string)

      Returns location of first occurrence of search_string in string, counting from 1. Returns 0 if no match found.
    `),
    url: `${duck}/text#instrstring-search_string`,
    args: [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    returns: 'number',
  },
  {
    name: 'left',
    description: trim(`
      left(string, count)

      Extracts the left-most count characters.
    `),
    url: `${duck}/text#leftstring-count`,
    args: [
      ['string', 'string'],
      ['count', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'length',
    description: trim(`
      length(string)

      Number of characters in string.
    `),
    url: `${duck}/text#lengthstring`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'lower',
    description: trim(`
      lower(string)

      Converts string to lower case.
    `),
    url: `${duck}/text#lowerstring`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'lpad',
    description: trim(`
      lpad(string, count, character)

      Pads the string with the character on the left until it has count characters. Truncates the string on the right if it has more than count characters.
    `),
    url: `${duck}/text#lpadstring-count-character`,
    args: [
      ['string', 'string'],
      ['count', 'number'],
      ['character', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'ltrim',
    description: trim(`
      ltrim(string, characters)

      Removes any occurrences of any of the characters from the left side of the string.
    `),
    url: `${duck}/text#ltrimstring-characters`,
    args: [
      ['string', 'string'],
      ['characters', 'string?'],
    ],
    returns: 'string',
  },
  {
    name: 'md5',
    description: trim(`
      md5(string)

      Returns the MD5 hash of the string as a VARCHAR.
    `),
    url: `${duck}/text#md5string`,
    args: [['value', ['string', 'bytes']]],
    returns: 'string',
  },
  textFunction('md5_number', [{name: 'value', type: ['string', 'bytes']}], 'number', 'md5_number(value)\n\nReturns the MD5 hash as a huge integer.', {url: `${duck}/text#md5_numberstring`}),
  textFunction('md5_number_lower', [{name: 'value', type: ['string', 'bytes']}], 'number', 'md5_number_lower(value)\n\nReturns the lower 64 bits of the MD5 hash as an integer.', {
    url: `${duck}/text#md5_number_lowerstring`,
  }),
  textFunction('md5_number_upper', [{name: 'value', type: ['string', 'bytes']}], 'number', 'md5_number_upper(value)\n\nReturns the upper 64 bits of the MD5 hash as an integer.', {
    url: `${duck}/text#md5_number_upperstring`,
  }),
  ...['sha1', 'sha256'].map(name =>
    textFunction(name, [{name: 'value', type: ['string', 'bytes']}], 'string', `${name}(value)\n\nReturns a cryptographic hash as text.`, {url: `${duck}/text#${name}value`}),
  ),
  {
    name: 'printf',
    description: trim(`
      printf(format, ...)

      Formats a string using printf syntax.
    `),
    url: `${duck}/text#printfformat-`,
    args: [
      {name: 'format_string', type: 'string'},
      {name: 'values', type: 'any...'},
    ],
    returns: 'string',
  },
  textFunction(
    'regexp_escape',
    [{name: 'string', type: 'string'}],
    'string',
    `
      regexp_escape(string)

      Escapes special regex characters in a string.
    `,
    {url: `${duck}/text#regexp_escapestring`},
  ),
  {
    name: 'regexp_extract',
    description: trim(`
      regexp_extract(string, regex, group)

      If string contains the regex pattern, returns the capturing group specified by optional parameter group; otherwise, returns the empty string.
    `),
    url: `${duck}/text#regexp_extractstring-regex-group-options`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'group', type: 'number?'},
      {name: 'options', type: 'string?'},
    ],
    returns: 'string',
  },
  textFunction(
    'regexp_extract_all',
    [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'group', type: 'number?'},
      {name: 'options', type: 'string?'},
    ],
    'array<string>',
    `
      regexp_extract_all(string, regex[, group][, options])

      Returns all non-overlapping regex matches or capturing groups as a list.
    `,
    {url: `${duck}/text#regexp_extract_allstring-regex-group-options`},
  ),
  textFunction(
    'regexp_full_match',
    [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'options', type: 'string?'},
    ],
    'boolean',
    `
      regexp_full_match(string, regex[, options])

      Returns true if the whole string matches the regex.
    `,
    {url: `${duck}/text#regexp_full_matchstring-regex-options`},
  ),
  {
    name: 'regexp_matches',
    description: trim(`
      regexp_matches(string, regex)

      Returns true if string contains the regex, false otherwise.
    `),
    url: `${duck}/text#regexp_matchesstring-regex-options`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'options', type: 'string?'},
    ],
    returns: 'boolean',
  },
  {
    name: 'regexp_replace',
    description: trim(`
      regexp_replace(string, regex, replacement)

      If string contains the regex, replaces the matching part with replacement.
    `),
    url: `${duck}/text#regexp_replacestring-regex-replacement-options`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'replacement', type: 'string'},
      {name: 'options', type: 'string?'},
    ],
    returns: 'string',
  },
  textFunction(
    'regexp_split_to_array',
    [
      {name: 'string', type: 'string'},
      {name: 'regex', type: 'string'},
      {name: 'options', type: 'string?'},
    ],
    'array<string>',
    `
      regexp_split_to_array(string, regex[, options])

      Splits string by regex into a list of strings.
    `,
    {url: `${duck}/text#regexp_split_to_arraystring-regex-options`},
  ),
  {
    name: 'repeat',
    description: trim(`
      repeat(string, count)

      Repeats the string count number of times.
    `),
    url: `${duck}/text#repeatstring-count`,
    args: [
      ['string', 'string'],
      ['count', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'replace',
    description: trim(`
      replace(string, source, target)

      Replaces any occurrences of the source with target in string.
    `),
    url: `${duck}/text#replacestring-source-target`,
    args: [
      ['string', 'string'],
      ['source', 'string'],
      ['target', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'reverse',
    description: trim(`
      reverse(string)

      Reverses the string.
    `),
    url: `${duck}/text#reversestring`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'right',
    description: trim(`
      right(string, count)

      Extract the right-most count characters.
    `),
    url: `${duck}/text#rightstring-count`,
    args: [
      ['string', 'string'],
      ['count', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'rpad',
    description: trim(`
      rpad(string, count, character)

      Pads the string with the character on the right until it has count characters. Truncates the string on the right if it has more than count characters.
    `),
    url: `${duck}/text#rpadstring-count-character`,
    args: [
      ['string', 'string'],
      ['count', 'number'],
      ['character', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'rtrim',
    description: trim(`
      rtrim(string, characters)

      Removes any occurrences of any of the characters from the right side of the string.
    `),
    url: `${duck}/text#rtrimstring-characters`,
    args: [
      ['string', 'string'],
      ['characters', 'string?'],
    ],
    returns: 'string',
  },
  {
    name: 'split_part',
    description: trim(`
      split_part(string, separator, index)

      Splits the string along the separator and returns the data at the (1-based) index of the list.
    `),
    url: `${duck}/text#split_partstring-separator-index`,
    args: [
      ['string', 'string'],
      ['separator', 'string'],
      ['index', 'number'],
    ],
    returns: 'string',
  },
  {
    name: 'starts_with',
    description: trim(`
      starts_with(string, search_string)

      Returns true if string begins with search_string.
    `),
    url: `${duck}/text#starts_withstring-search_string`,
    args: [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    returns: 'boolean',
  },
  {
    name: 'string_split',
    description: trim(`
      string_split(string, separator)

      Splits the string along the separator.
    `),
    url: `${duck}/text#string_splitstring-separator`,
    args: [
      ['string', 'string'],
      ['separator', 'string'],
    ],
    returns: 'array<string>',
  },
  ...['split', 'str_split', 'string_to_array'].map(name =>
    textFunction(
      name,
      [
        {name: 'string', type: 'string'},
        {name: 'separator', type: 'string'},
      ],
      'array<string>',
      `${name}(string, separator)\n\nSplits the string along the separator.`,
      {url: `${duck}/text#string_splitstring-separator`},
    ),
  ),
  ...['string_split_regex', 'str_split_regex'].map(name =>
    textFunction(
      name,
      [
        {name: 'string', type: 'string'},
        {name: 'regex', type: 'string'},
        {name: 'options', type: 'string?'},
      ],
      'array<string>',
      `${name}(string, regex[, options])\n\nSplits string by regex into a list of strings.`,
      {url: `${duck}/text#string_split_regexstring-regex-options`},
    ),
  ),
  {
    name: 'strip_accents',
    description: trim(`
      strip_accents(string)

      Strips accents from string.
    `),
    url: `${duck}/text#strip_accentsstring`,
    args: [['string', 'string']],
    returns: 'string',
  },
  {
    name: 'strlen',
    description: trim(`
      strlen(string)

      Number of bytes in string.
    `),
    url: `${duck}/text#strlenstring`,
    args: [['string', 'string']],
    returns: 'number',
  },
  {
    name: 'strpos',
    description: trim(`
      strpos(string, search_string)

      Alias for instr.
    `),
    url: `${duck}/text#instrstring-search_string`,
    args: [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    returns: 'number',
  },
  {
    name: 'substr',
    description: trim(`
      substr(string, start, length)

      Alias for substring.
    `),
    url: `${duck}/text#substringstring-start-length`,
    args: [
      ['string', 'string'],
      ['start', 'number'],
      ['length', 'number?'],
    ],
    returns: 'string',
  },
  {
    name: 'substring',
    description: trim(`
      substring(string, start, length)

      Extracts substring starting from character start. If optional argument length is set, extracts a substring of length characters instead.
    `),
    url: `${duck}/text#substringstring-start-length`,
    args: [
      ['string', 'string'],
      ['start', 'number'],
      ['length', 'number?'],
    ],
    returns: 'string',
  },
  {
    name: 'trim',
    description: trim(`
      trim(string, characters)

      Removes any occurrences of any of the characters from either side of the string.
    `),
    url: `${duck}/text#trimstring-characters`,
    args: [
      ['string', 'string'],
      ['characters', 'string?'],
    ],
    returns: 'string',
  },
  {
    name: 'unicode',
    description: trim(`
      unicode(string)

      Returns an INTEGER representing the unicode codepoint of the first character in the string.
    `),
    url: `${duck}/text#unicodestring`,
    args: [['string', 'string']],
    returns: 'number',
  },
  textFunction(
    'damerau_levenshtein',
    [
      ['s1', 'string'],
      ['s2', 'string'],
    ],
    'number',
    'damerau_levenshtein(s1, s2)\n\nReturns the Damerau-Levenshtein distance between two strings.',
    {url: `${duck}/text#damerau_levenshteins1-s2`},
  ),
  textFunction(
    'editdist3',
    [
      ['s1', 'string'],
      ['s2', 'string'],
    ],
    'number',
    'editdist3(s1, s2)\n\nReturns the Levenshtein distance between two strings.',
    {url: `${duck}/text#editdist3s1-s2`},
  ),
  textFunction(
    'hamming',
    [
      ['s1', 'string'],
      ['s2', 'string'],
    ],
    'number',
    'hamming(s1, s2)\n\nReturns the Hamming distance between two strings.',
    {url: `${duck}/text#hammings1-s2`},
  ),
  textFunction(
    'levenshtein',
    [
      ['s1', 'string'],
      ['s2', 'string'],
    ],
    'number',
    'levenshtein(s1, s2)\n\nReturns the Levenshtein distance between two strings.',
    {url: `${duck}/text#levenshteins1-s2`},
  ),
  textFunction(
    'mismatches',
    [
      ['s1', 'string'],
      ['s2', 'string'],
    ],
    'number',
    'mismatches(s1, s2)\n\nReturns the number of positions where two strings differ.',
    {url: `${duck}/text#mismatchess1-s2`},
  ),
  ...['jaro_similarity', 'jaro_winkler_similarity'].map(name =>
    textFunction(
      name,
      [
        {name: 's1', type: 'string'},
        {name: 's2', type: 'string'},
        {name: 'score_cutoff', type: 'number?'},
      ],
      'number',
      `${name}(s1, s2[, score_cutoff])\n\nReturns a string similarity score.`,
      {url: `${duck}/text#${name}s1-s2-score_cutoff`},
    ),
  ),
  ...['like_escape', 'ilike_escape', 'not_like_escape', 'not_ilike_escape'].map(name =>
    textFunction(
      name,
      [
        {name: 'string', type: 'string'},
        {name: 'like_specifier', type: 'string'},
        {name: 'escape_character', type: 'string'},
      ],
      'boolean',
      `${name}(string, like_specifier, escape_character)\n\nEvaluates a LIKE-style comparison with an escape character.`,
      {url: `${duck}/text#${name}string-like_specifier-escape_character`},
    ),
  ),
  textFunction(
    'prefix',
    [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    'boolean',
    'prefix(string, search_string)\n\nReturns true if string begins with search_string.',
    {url: `${duck}/text#prefixstring-search_string`},
  ),
  textFunction(
    'suffix',
    [
      ['string', 'string'],
      ['search_string', 'string'],
    ],
    'boolean',
    'suffix(string, search_string)\n\nReturns true if string ends with search_string.',
    {url: `${duck}/text#suffixstring-search_string`},
  ),
  textFunction(
    'bar',
    [
      {name: 'x', type: 'number'},
      {name: 'min', type: 'number'},
      {name: 'max', type: 'number'},
      {name: 'width', type: 'number?'},
    ],
    'string',
    'bar(x, min, max[, width])\n\nDraws a proportional text bar.',
    {url: `${duck}/text#barx-min-max-width`},
  ),
  textFunction('format_bytes', [['integer', 'number']], 'string', 'format_bytes(integer)\n\nFormats bytes as a human-readable string.', {url: `${duck}/text#format_bytesinteger`}),
  textFunction('formatreadablesize', [['integer', 'number']], 'string', 'formatReadableSize(integer)\n\nFormats bytes as a human-readable string.', {
    url: `${duck}/text#formatreadablesizeinteger`,
    sqlName: 'formatReadableSize',
  }),
  textFunction('formatreadabledecimalsize', [['integer', 'number']], 'string', 'formatReadableDecimalSize(integer)\n\nFormats bytes as a human-readable decimal-size string.', {
    url: `${duck}/text#formatreadabledecimalsizeinteger`,
    sqlName: 'formatReadableDecimalSize',
  }),
  textFunction('parse_formatted_bytes', [['string', 'string']], 'number', 'parse_formatted_bytes(string)\n\nParses a human-readable byte string into bytes.', {
    url: `${duck}/text#parse_formatted_bytesstring`,
  }),
  ...['hex', 'to_hex', 'bin', 'to_binary'].map(name => textFunction(name, [{name: 'value', type: 'any'}], 'string', `${name}(value)\n\nEncodes a value as text.`, {url: `${duck}/text#${name}value`})),
  ...['unhex', 'from_hex', 'unbin', 'from_binary'].map(name =>
    textFunction(name, [{name: 'value', type: 'string'}], 'string', `${name}(value)\n\nDecodes text into bytes.`, {url: `${duck}/text#${name}value`}),
  ),
  ...['base64', 'to_base64'].map(name =>
    textFunction(name, [{name: 'blob', type: ['string', 'bytes']}], 'string', `${name}(blob)\n\nEncodes bytes as base64 text.`, {url: `${duck}/text#${name}blob`}),
  ),
  textFunction('from_base64', [['string', 'string']], 'string', 'from_base64(string)\n\nDecodes base64 text into bytes.', {url: `${duck}/text#from_base64string`}),
  textFunction('encode', [['string', 'string']], 'string', 'encode(string)\n\nEncodes a string as bytes.', {url: `${duck}/text#encodestring`}),
  textFunction(
    'decode',
    [
      {name: 'blob', type: ['string', 'bytes']},
      {name: 'encoding', type: 'string?'},
    ],
    'string',
    'decode(blob[, encoding])\n\nDecodes bytes to text.',
    {url: `${duck}/text#decodeblob`},
  ),
  textFunction(
    'to_base',
    [
      {name: 'number', type: 'number'},
      {name: 'radix', type: 'number'},
      {name: 'min_length', type: 'number?'},
    ],
    'string',
    'to_base(number, radix[, min_length])\n\nConverts a number to text in the supplied base.',
    {url: `${duck}/text#to_basenumber-radix-min_length`},
  ),
  textFunction('url_encode', [['string', 'string']], 'string', 'url_encode(string)\n\nURL-encodes a string.', {url: `${duck}/text#url_encodestring`}),
  textFunction('url_decode', [['string', 'string']], 'string', 'url_decode(string)\n\nURL-decodes a string.', {url: `${duck}/text#url_decodestring`}),
  {
    name: 'upper',
    description: trim(`
      upper(string)

      Converts string to upper case.
    `),
    url: `${duck}/text#upperstring`,
    args: [['string', 'string']],
    returns: 'string',
  },

  // ============================================================================
  // Date Functions
  // https://duckdb.org/docs/stable/sql/functions/date.html
  // ============================================================================

  {
    name: 'date_add',
    description: trim(`
      date_add(date, interval)

      Add the interval to the date and return a DATETIME value.
    `),
    url: `${duck}/date#date_adddate-interval`,
    args: [
      ['date', 'date'],
      ['interval', 'interval'],
    ],
    returns: 'timestamp',
  },
  {
    name: 'date_diff',
    description: trim(`
      date_diff(part, startdate, enddate)

      The number of part boundaries between startdate and enddate.
    `),
    url: `${duck}/date#date_diffpart-startdate-enddate`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'startdate', type: ['date', 'timestamp']},
      {name: 'enddate', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'date_part',
    description: trim(`
      date_part(part, date)

      Get subfield (equivalent to extract).
    `),
    url: `${duck}/date#date_partpart-date`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'date', type: ['date', 'timestamp']},
    ],
    returns: 'number',
    metadata: args => inferTimeOrdinal(args[0]?.sql, 'duckdb'),
  },
  {
    name: 'year',
    description: trim(`
      year(date)

      Extracts the year.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('year', 'duckdb'),
  },
  {
    name: 'quarter',
    description: trim(`
      quarter(date)

      Extracts the quarter.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('quarter', 'duckdb'),
  },
  {
    name: 'month',
    description: trim(`
      month(date)

      Extracts the month.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('month', 'duckdb'),
  },
  {
    name: 'week',
    description: trim(`
      week(date)

      Extracts the week number.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('week', 'duckdb'),
  },
  {
    name: 'weekofyear',
    description: trim(`
      weekofyear(date)

      Extracts the ISO week number.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('weekofyear', 'duckdb'),
  },
  {
    name: 'day',
    description: trim(`
      day(date)

      Extracts the day of month.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('day', 'duckdb'),
  },
  {
    name: 'dayofmonth',
    description: trim(`
      dayofmonth(date)

      Extracts the day of month.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('dayofmonth', 'duckdb'),
  },
  {
    name: 'dayofweek',
    description: trim(`
      dayofweek(date)

      Extracts the day of week.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('dayofweek', 'duckdb'),
  },
  {
    name: 'weekday',
    description: trim(`
      weekday(date)

      Extracts the day of week.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('weekday', 'duckdb'),
  },
  {
    name: 'dayofyear',
    description: trim(`
      dayofyear(date)

      Extracts the day of year.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('dayofyear', 'duckdb'),
  },
  {
    name: 'hour',
    description: trim(`
      hour(date)

      Extracts the hour.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('hour', 'duckdb'),
  },
  {
    name: 'minute',
    description: trim(`
      minute(date)

      Extracts the minute.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('minute', 'duckdb'),
  },
  {
    name: 'second',
    description: trim(`
      second(date)

      Extracts the second.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('second', 'duckdb'),
  },
  {
    name: 'isodow',
    description: trim(`
      isodow(date)

      Extracts the ISO day of week.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('isodow', 'duckdb'),
  },
  {
    name: 'isoyear',
    description: trim(`
      isoyear(date)

      Extracts the ISO year.
    `),
    url: `${duck}/datepart.html`,
    args: [{name: 'date', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('isoyear', 'duckdb'),
  },
  {
    name: 'date_sub',
    description: trim(`
      date_sub(part, startdate, enddate)

      The signed length of the interval between startdate and enddate, truncated to whole multiples of part.
    `),
    url: `${duck}/date#date_subpart-startdate-enddate`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'startdate', type: ['date', 'timestamp']},
      {name: 'enddate', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'dayname',
    description: trim(`
      dayname(date)

      The (English) name of the weekday.
    `),
    url: `${duck}/date#daynamedate`,
    args: [['date', 'date']],
    returns: 'string',
  },
  {
    name: 'last_day',
    description: trim(`
      last_day(date)

      The last day of the corresponding month in the date.
    `),
    url: `${duck}/date#last_daydate`,
    args: [['date', 'date']],
    returns: 'date',
  },
  {
    name: 'make_date',
    description: trim(`
      make_date(year, month, day)

      The date for the given parts.
    `),
    url: `${duck}/date#make_dateyear-month-day`,
    args: [
      ['year', 'number'],
      ['month', 'number'],
      ['day', 'number'],
    ],
    returns: 'date',
  },
  {
    name: 'monthname',
    description: trim(`
      monthname(date)

      The (English) name of the month.
    `),
    url: `${duck}/date#monthnamedate`,
    args: [['date', 'date']],
    returns: 'string',
  },
  {
    name: 'strftime',
    description: trim(`
      strftime(timestamp, format)

      Converts a timestamp to a string according to the format string.
    `),
    url: `${duck}/date#strftimedate-format`,
    args: [
      ['timestamp', 'timestamp'],
      ['format', 'string'],
    ],
    returns: 'string',
  },
  {
    name: 'today',
    description: trim(`
      today()

      Current date (start of current transaction) in the local time zone.
    `),
    url: `${duck}/date#today`,
    args: [],
    returns: 'date',
  },

  // ============================================================================
  // Timestamp Functions
  // https://duckdb.org/docs/stable/sql/functions/timestamp.html
  // ============================================================================

  {
    name: 'age',
    description: trim(`
      age(timestamp, timestamp)

      Subtract arguments, resulting in the time difference between the two timestamps.
    `),
    url: `${duck}/timestamp#agetimestamp-timestamp`,
    args: [
      ['timestamp1', 'timestamp'],
      ['timestamp2', 'timestamp?'],
    ],
    returns: 'interval',
  },
  {
    name: 'century',
    description: trim(`
      century(timestamp)

      Extracts the century of a timestamp.
    `),
    url: `${duck}/timestamp#centurytimestamp`,
    args: [['timestamp', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'epoch',
    description: trim(`
      epoch(timestamp)

      Returns the total number of seconds since the epoch.
    `),
    url: `${duck}/timestamp#epochtimestamp`,
    args: [['timestamp', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'epoch_ms',
    description: trim(`
      epoch_ms(timestamp)

      Returns the total number of milliseconds since the epoch.
    `),
    url: `${duck}/timestamp#epoch_mstimestamp`,
    args: [['timestamp', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'epoch_ns',
    description: trim(`
      epoch_ns(timestamp)

      Returns the total number of nanoseconds since the epoch.
    `),
    url: `${duck}/timestamp#epoch_nstimestamp`,
    args: [['timestamp', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'epoch_us',
    description: trim(`
      epoch_us(timestamp)

      Returns the total number of microseconds since the epoch.
    `),
    url: `${duck}/timestamp#epoch_ustimestamp`,
    args: [['timestamp', 'timestamp']],
    returns: 'number',
  },
  {
    name: 'make_timestamp',
    description: trim(`
      make_timestamp(year, month, day, hour, minute, second)

      The timestamp for the given parts.
    `),
    url: `${duck}/timestamp#make_timestampbigint-bigint-bigint-bigint-bigint-double`,
    args: [
      ['year', 'number'],
      ['month', 'number'],
      ['day', 'number'],
      ['hour', 'number'],
      ['minute', 'number'],
      ['second', 'number'],
    ],
    returns: 'time',
  },
  {
    name: 'now',
    description: trim(`
      now()

      Current date and time (start of current transaction).
    `),
    url: `${duck}/timestamp#current_localtimestamp`,
    args: [],
    returns: 'timestamp',
  },
  {
    name: 'strptime',
    description: trim(`
      strptime(text, format)

      Converts the string text to timestamp according to the format string.
    `),
    url: `${duck}/timestamp#strptimetext-format`,
    args: [
      ['text', 'string'],
      ['format', 'string'],
    ],
    returns: 'timestamp',
  },
  {
    name: 'time_bucket',
    description: trim(`
      time_bucket(bucket_width, timestamp)

      Truncate timestamp to a grid of width bucket_width.
    `),
    url: `${duck}/timestamp#time_bucketbucket_width-timestamp-offset`,
    args: [
      ['bucket_width', 'interval'],
      ['timestamp', 'timestamp'],
    ],
    returns: 'timestamp',
  },

  // ============================================================================
  // JSON Functions
  // https://duckdb.org/docs/stable/data/json/json_functions
  // https://duckdb.org/docs/stable/data/json/creating_json
  // https://duckdb.org/docs/stable/data/json/json_aggregates
  // https://duckdb.org/docs/stable/data/json/sql_to_and_from_json
  // ============================================================================

  jsonFunction(
    'json',
    [{name: 'json', type: ['json', 'string']}],
    'json',
    `
    json(json)

    Parse and minify json. Throws an error if the supplied value is invalid JSON.
  `,
  ),
  jsonFunction(
    'json_valid',
    [{name: 'json', type: ['json', 'string']}],
    'boolean',
    `
    json_valid(json)

    Returns true if the supplied value is valid JSON.
  `,
  ),
  jsonFunction(
    'json_exists',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: 'string'},
    ],
    'boolean',
    `
      json_exists(json, path)

      Returns true if the path exists in the JSON value.
    `,
  ),
  jsonFunction(
    'json_extract',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: ['string', 'number']},
    ],
    'json',
    `
      json_extract(json, path)

      Extracts JSON from the supplied path.
    `,
  ),
  jsonFunction(
    'json_extract_path',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: ['string', 'number']},
    ],
    'json',
    `
      json_extract_path(json, path)

      Alias-compatible DuckDB spelling for extracting JSON from the supplied path.
    `,
  ),
  jsonFunction(
    'json_extract_string',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: ['string', 'number']},
    ],
    'string',
    `
      json_extract_string(json, path)

      Extracts a value from JSON and returns it as VARCHAR.
    `,
  ),
  jsonFunction(
    'json_extract_path_text',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: ['string', 'number']},
    ],
    'string',
    `
      json_extract_path_text(json, path)

      Alias-compatible DuckDB spelling for extracting a JSON value as VARCHAR.
    `,
  ),
  jsonFunction(
    'json_value',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: ['string', 'number']},
    ],
    'string',
    `
      json_value(json, path)

      Extracts a scalar JSON value as VARCHAR. Returns NULL when the selected value is not scalar.
    `,
  ),
  jsonFunction(
    'json_array_length',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: 'string?'},
    ],
    'number',
    `
      json_array_length(json[, path])

      Returns the number of elements in the JSON array, or 0 if the value is not a JSON array.
    `,
  ),
  jsonFunction(
    'json_contains',
    [
      {name: 'json_haystack', type: ['json', 'string']},
      {name: 'json_needle', type: ['json', 'string', 'number']},
    ],
    'boolean',
    `
      json_contains(json_haystack, json_needle)

      Returns true if json_needle is contained in json_haystack.
    `,
  ),
  jsonFunction(
    'json_keys',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: 'string?'},
    ],
    'array<string>',
    `
      json_keys(json[, path])

      Returns the keys of a JSON object as a LIST of VARCHAR.
    `,
  ),
  jsonFunction(
    'json_structure',
    [{name: 'json', type: ['json', 'string']}],
    'json',
    `
    json_structure(json)

    Returns the structure of a JSON value.
  `,
  ),
  jsonFunction(
    'json_type',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'path', type: 'string?'},
    ],
    'string',
    `
      json_type(json[, path])

      Returns the type of the JSON value, or the type of the value at path.
    `,
  ),
  jsonFunction(
    'json_transform',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'structure', type: 'string'},
    ],
    'record',
    `
      json_transform(json, structure)

      Transforms JSON according to the supplied structure.
    `,
  ),
  jsonFunction(
    'json_transform_strict',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'structure', type: 'string'},
    ],
    'record',
    `
      json_transform_strict(json, structure)

      Strictly transforms JSON according to the supplied structure and errors when casts fail.
    `,
  ),
  jsonFunction(
    'from_json',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'structure', type: 'string'},
    ],
    'record',
    `
      from_json(json, structure)

      Alias-compatible DuckDB spelling for json_transform.
    `,
  ),
  jsonFunction(
    'from_json_strict',
    [
      {name: 'json', type: ['json', 'string']},
      {name: 'structure', type: 'string'},
    ],
    'record',
    `
      from_json_strict(json, structure)

      Alias-compatible DuckDB spelling for json_transform_strict.
    `,
  ),
  jsonFunction(
    'to_json',
    [{name: 'value', type: 'any'}],
    'json',
    `
    to_json(value)

    Creates JSON from any value.
  `,
  ),
  jsonFunction(
    'json_quote',
    [{name: 'value', type: 'any'}],
    'json',
    `
    json_quote(value)

    Alias-compatible DuckDB spelling for to_json.
  `,
  ),
  jsonFunction(
    'array_to_json',
    [{name: 'array', type: 'array'}],
    'json',
    `
    array_to_json(array)

    Creates JSON from a LIST value.
  `,
  ),
  jsonFunction(
    'row_to_json',
    [{name: 'row', type: 'record'}],
    'json',
    `
    row_to_json(row)

    Creates JSON from a STRUCT value.
  `,
  ),
  jsonFunction(
    'json_array',
    [],
    'json',
    `
    json_array(any, ...)

    Creates a JSON array from the supplied values.
  `,
    {
      overloads: [
        {args: [], returns: 'json'},
        {args: [{name: 'values', type: 'any...'}], returns: 'json'},
      ],
    },
  ),
  jsonFunction(
    'json_object',
    [],
    'json',
    `
    json_object(key, value, ...)

    Creates a JSON object from the supplied key/value pairs.
  `,
    {
      overloads: [
        {args: [], returns: 'json'},
        {args: [{name: 'key_value_pairs', type: 'any...'}], returns: 'json'},
      ],
    },
  ),
  jsonFunction(
    'json_merge_patch',
    [
      {name: 'json1', type: ['json', 'string']},
      {name: 'json2', type: ['json', 'string']},
    ],
    'json',
    `
      json_merge_patch(json1, json2)

      Merges two JSON documents using merge-patch semantics.
    `,
  ),
  jsonFunction(
    'json_pretty',
    [{name: 'json', type: ['json', 'string']}],
    'string',
    `
    json_pretty(json)

    Pretty-prints a JSON value.
  `,
  ),
  jsonFunction(
    'json_group_array',
    [{name: 'value', type: 'any'}],
    'json',
    `
    json_group_array(value)

    Aggregates values into a JSON array.
  `,
    {aggregate: true},
  ),
  jsonFunction(
    'json_group_object',
    [
      {name: 'key', type: 'any'},
      {name: 'value', type: 'any'},
    ],
    'json',
    `
      json_group_object(key, value)

      Aggregates key/value pairs into a JSON object.
    `,
    {aggregate: true},
  ),
  jsonFunction(
    'json_group_structure',
    [{name: 'json', type: ['json', 'string']}],
    'json',
    `
    json_group_structure(json)

    Aggregates JSON values into a combined structure.
  `,
    {aggregate: true},
  ),
  jsonFunction(
    'json_serialize_sql',
    [
      {name: 'sql', type: 'string'},
      {name: 'skip_null', type: 'boolean?'},
      {name: 'skip_empty', type: 'boolean?'},
      {name: 'skip_default', type: 'boolean?'},
      {name: 'format', type: 'boolean?'},
    ],
    'json',
    `
      json_serialize_sql(sql[, skip_null, skip_empty, skip_default, format])

      Serializes a SQL query to JSON.
    `,
    {url: `${duckJson}/sql_to_and_from_json`},
  ),
  jsonFunction(
    'json_serialize_plan',
    [
      {name: 'sql', type: 'string'},
      {name: 'skip_null', type: 'boolean?'},
      {name: 'skip_empty', type: 'boolean?'},
      {name: 'skip_default', type: 'boolean?'},
      {name: 'format', type: 'boolean?'},
    ],
    'json',
    `
      json_serialize_plan(sql[, skip_null, skip_empty, skip_default, format])

      Serializes a SQL query plan to JSON.
    `,
    {url: `${duckJson}/sql_to_and_from_json`},
  ),
  jsonFunction(
    'json_deserialize_sql',
    [{name: 'serialized_sql', type: 'json'}],
    'string',
    `
    json_deserialize_sql(serialized_sql)

    Deserializes a serialized SQL JSON object back to SQL text.
  `,
    {url: `${duckJson}/sql_to_and_from_json`},
  ),

  // ============================================================================
  // Nested List, Array, Struct, and Map Functions
  // https://duckdb.org/docs/stable/sql/functions/list
  // https://duckdb.org/docs/stable/sql/functions/struct
  // https://duckdb.org/docs/stable/sql/functions/map
  // ============================================================================

  nestedFunction(
    'array_agg',
    [{name: 'arg', type: 'T'}],
    'array',
    `
      array_agg(arg)

      Returns a LIST containing all the values of a column. This function is affected by ordering.
    `,
    {aggregate: true, url: `${duck}/aggregates#array_aggarg`},
  ),
  ...['list_value', 'list_pack', 'array_value'].map(name =>
    nestedFunction(name, [], 'array', `${name}(any, ...)\n\nCreates a list from the supplied values.`, {
      overloads: [
        {args: [], returns: 'array'},
        {args: [{name: 'values', type: 'any...'}], returns: 'array'},
      ],
    }),
  ),
  ...['list_concat', 'list_cat', 'array_concat', 'array_cat'].map(name =>
    nestedFunction(name, [], 'array', `${name}(list, ...)\n\nConcatenates lists.`, {
      overloads: [
        {args: [], returns: 'array'},
        {args: [{name: 'lists', type: 'array...'}], returns: 'array'},
      ],
    }),
  ),
  ...['list_append', 'array_append', 'array_push_back'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'element', type: 'any'},
      ],
      'array',
      `${name}(list, element)\n\nAppends element to list.`,
    ),
  ),
  ...['list_prepend', 'array_prepend', 'array_push_front'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'element', type: 'any'},
        {name: 'list', type: 'array'},
      ],
      'array',
      `${name}(element, list)\n\nPrepends element to list.`,
    ),
  ),
  ...['array_pop_back', 'array_pop_front', 'list_reverse', 'array_reverse', 'list_distinct', 'array_distinct'].map(name =>
    nestedFunction(name, [{name: 'list', type: 'array'}], 'array', `${name}(list)\n\nReturns a transformed list.`),
  ),
  ...['list_sort', 'array_sort', 'list_reverse_sort', 'array_reverse_sort', 'list_grade_up', 'array_grade_up'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'col1', type: 'string?'},
        {name: 'col2', type: 'string?'},
      ],
      'array',
      `${name}(list[, col1][, col2])\n\nReturns a reordered list.`,
    ),
  ),
  ...['list_slice', 'array_slice'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'begin', type: 'number'},
        {name: 'end', type: 'number'},
        {name: 'step', type: 'number?'},
      ],
      'array',
      `${name}(list, begin, end[, step])\n\nExtracts a sublist.`,
    ),
  ),
  ...['list_resize', 'array_resize'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'size', type: 'number'},
        {name: 'value', type: 'any?'},
      ],
      'array',
      `${name}(list, size[, value])\n\nResizes a list.`,
    ),
  ),
  ...['list_select', 'array_select'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'value_list', type: 'array'},
        {name: 'index_list', type: 'array'},
      ],
      'array',
      `${name}(value_list, index_list)\n\nReturns values at the supplied indexes.`,
    ),
  ),
  ...['list_where', 'array_where'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'value_list', type: 'array'},
        {name: 'mask_list', type: 'array'},
      ],
      'array',
      `${name}(value_list, mask_list)\n\nReturns values selected by a boolean mask list.`,
    ),
  ),
  ...['list_intersect', 'array_intersect'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list1', type: 'array'},
        {name: 'list2', type: 'array'},
      ],
      'array',
      `${name}(list1, list2)\n\nReturns the intersection of two lists.`,
    ),
  ),
  ...['list_extract', 'list_element', 'array_extract'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'index', type: 'number'},
      ],
      'array_element',
      `${name}(list, index)\n\nExtracts the indexth, 1-based value from the list.`,
    ),
  ),
  ...['list_contains', 'list_has', 'array_contains', 'array_has'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'element', type: 'any'},
      ],
      'boolean',
      `${name}(list, element)\n\nReturns true if list contains element.`,
    ),
  ),
  ...['list_has_all', 'array_has_all', 'list_has_any', 'array_has_any'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list1', type: 'array'},
        {name: 'list2', type: 'array'},
      ],
      'boolean',
      `${name}(list1, list2)\n\nCompares list membership between two lists.`,
    ),
  ),
  ...['list_position', 'list_indexof', 'array_position', 'array_indexof'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'element', type: 'any'},
      ],
      'number',
      `${name}(list, element)\n\nReturns the 1-based position of element in list.`,
    ),
  ),
  ...['list_unique', 'array_unique', 'list_approx_count_distinct', 'list_count'].map(name =>
    nestedFunction(name, [{name: 'list', type: 'array'}], 'number', `${name}(list)\n\nReturns a numeric summary for the list.`),
  ),
  ...[
    'list_avg',
    'list_sum',
    'list_product',
    'list_median',
    'list_entropy',
    'list_kurtosis',
    'list_kurtosis_pop',
    'list_mad',
    'list_sem',
    'list_skewness',
    'list_stddev_pop',
    'list_stddev_samp',
    'list_var_pop',
    'list_var_samp',
  ].map(name => nestedFunction(name, [{name: 'list', type: 'array'}], 'number', `${name}(list)\n\nApplies the corresponding aggregate to the list.`)),
  ...['list_first', 'list_last', 'list_any_value', 'list_min', 'list_max', 'list_mode'].map(name =>
    nestedFunction(name, [{name: 'list', type: 'array'}], 'array_element', `${name}(list)\n\nReturns one element from the list.`),
  ),
  ...['list_bool_and', 'list_bool_or'].map(name => nestedFunction(name, [{name: 'list', type: 'array'}], 'boolean', `${name}(list)\n\nApplies a boolean aggregate to the list.`)),
  nestedFunction('list_string_agg', [{name: 'list', type: 'array'}], 'string', 'list_string_agg(list)\n\nConcatenates the list values into a string.'),
  nestedFunction(
    'list_histogram',
    [{name: 'list', type: 'array'}],
    'map',
    `
      list_histogram(list)

      Applies histogram to the list and returns a map.
    `,
  ),
  ...['list_aggregate', 'list_aggr', 'array_aggregate', 'array_aggr', 'aggregate'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list', type: 'array'},
        {name: 'function_name', type: 'string'},
        {name: 'arguments', type: 'any...'},
      ],
      'sql native',
      `${name}(list, function_name, ...)\n\nExecutes the named aggregate on the elements of list.`,
    ),
  ),
  ...[
    'list_cosine_distance',
    'array_cosine_distance',
    'list_cosine_similarity',
    'array_cosine_similarity',
    'list_distance',
    'array_distance',
    'list_dot_product',
    'array_dot_product',
    'list_inner_product',
    'array_inner_product',
    'list_negative_dot_product',
    'array_negative_dot_product',
    'list_negative_inner_product',
    'array_negative_inner_product',
  ].map(name =>
    nestedFunction(
      name,
      [
        {name: 'list1', type: 'array'},
        {name: 'list2', type: 'array'},
      ],
      'number',
      `${name}(list1, list2)\n\nComputes a numeric vector comparison between two lists.`,
    ),
  ),
  nestedFunction(
    'array_cross_product',
    [
      {name: 'array1', type: 'array'},
      {name: 'array2', type: 'array'},
    ],
    'array<number>',
    `
      array_cross_product(array1, array2)

      Computes the cross product of two 3-element numeric arrays.
    `,
  ),

  nestedFunction(
    'row',
    [{name: 'values', type: 'any...'}],
    'record',
    `
      row(any, ...)

      Creates an unnamed STRUCT containing the argument values.
    `,
    {url: duckStruct},
  ),
  nestedFunction('struct_concat', [{name: 'structs', type: 'record...'}], 'record', 'struct_concat(structs...)\n\nMerges structs into a single struct.', {url: duckStruct}),
  ...['struct_contains', 'struct_has'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'struct', type: 'record'},
        {name: 'entry', type: 'any'},
      ],
      'boolean',
      `${name}(struct, entry)\n\nChecks if the struct contains entry.`,
      {url: duckStruct},
    ),
  ),
  ...['struct_extract', 'struct_extract_at'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'struct', type: 'record'},
        {name: 'entry', type: ['string', 'number']},
      ],
      'sql native',
      `${name}(struct, entry)\n\nExtracts an entry from a struct.`,
      {url: duckStruct},
    ),
  ),
  ...['struct_position', 'struct_indexof'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'struct', type: 'record'},
        {name: 'entry', type: 'any'},
      ],
      'number',
      `${name}(struct, entry)\n\nReturns the 1-based position of entry in the struct.`,
      {url: duckStruct},
    ),
  ),
  nestedFunction('struct_keys', [{name: 'struct', type: 'record'}], 'array<string>', 'struct_keys(struct)\n\nReturns the struct keys.', {url: duckStruct}),
  nestedFunction('struct_values', [{name: 'struct', type: 'record'}], 'record', 'struct_values(struct)\n\nReturns the struct values as an unnamed struct.', {url: duckStruct}),

  nestedFunction(
    'map',
    [],
    'map',
    `
      map([keys, values])

      Creates a map from key and value lists, or an empty map when called with no arguments.
    `,
    {
      url: duckMap,
      overloads: [
        {args: [], returns: 'map'},
        {
          args: [
            {name: 'keys', type: 'array'},
            {name: 'values', type: 'array'},
          ],
          returns: 'map',
        },
      ],
    },
  ),
  nestedFunction('cardinality', [{name: 'map', type: 'map'}], 'number', 'cardinality(map)\n\nReturns the number of entries in the map.', {url: duckMap}),
  nestedFunction('map_concat', [], 'map', 'map_concat(maps...)\n\nMerges maps, taking later values on key collisions.', {
    url: duckMap,
    overloads: [
      {args: [], returns: 'map'},
      {args: [{name: 'maps', type: 'map...'}], returns: 'map'},
    ],
  }),
  ...['map_contains', 'map_contains_value'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'map', type: 'map'},
        {name: name == 'map_contains' ? 'key' : 'value', type: 'any'},
      ],
      'boolean',
      `${name}(map, value)\n\nChecks map membership.`,
      {url: duckMap},
    ),
  ),
  nestedFunction(
    'map_contains_entry',
    [
      {name: 'map', type: 'map'},
      {name: 'key', type: 'any'},
      {name: 'value', type: 'any'},
    ],
    'boolean',
    'map_contains_entry(map, key, value)\n\nChecks if a map contains a key/value pair.',
    {url: duckMap},
  ),
  ...['element_at', 'map_extract'].map(name =>
    nestedFunction(
      name,
      [
        {name: 'map', type: 'map'},
        {name: 'key', type: 'any'},
      ],
      'array',
      `${name}(map, key)\n\nReturns the value for key as a list.`,
      {url: duckMap},
    ),
  ),
  nestedFunction(
    'map_extract_value',
    [
      {name: 'map', type: 'map'},
      {name: 'key', type: 'any'},
    ],
    'sql native',
    'map_extract_value(map, key)\n\nReturns the value for key, or NULL if the key is absent.',
    {url: duckMap},
  ),
  nestedFunction('map_entries', [{name: 'map', type: 'map'}], 'array<record>', 'map_entries(map)\n\nReturns a list of key/value structs.', {url: duckMap}),
  nestedFunction('map_from_entries', [{name: 'entries', type: 'array'}], 'map', 'map_from_entries(entries)\n\nCreates a map from key/value struct entries.', {url: duckMap}),
  nestedFunction('map_keys', [{name: 'map', type: 'map'}], 'array', 'map_keys(map)\n\nReturns the map keys as a list.', {url: duckMap}),
  nestedFunction('map_values', [{name: 'map', type: 'map'}], 'array', 'map_values(map)\n\nReturns the map values as a list.', {url: duckMap}),

  // ============================================================================
  // Utility Functions
  // ============================================================================

  {
    name: 'coalesce',
    description: trim(`
      coalesce(expr, ...)

      Returns the first non-null expression from the list. If all are null, returns null.
    `),
    url: `${duck}/utility`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'ifnull',
    description: trim(`
      ifnull(expr, alt)

      Returns expr if it is not null, otherwise returns alt.
    `),
    url: `${duck}/utility`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'alt', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'nullif',
    description: trim(`
      nullif(expr1, expr2)

      Returns null if expr1 equals expr2, otherwise returns expr1.
    `),
    url: `${duck}/utility`,
    args: [
      {name: 'expr1', type: 'T'},
      {name: 'expr2', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'typeof',
    description: trim(`
      typeof(expression)

      Returns the name of the data type of the result of the expression.
    `),
    url: `${duck}/utility`,
    args: [{name: 'expression', type: 'any'}],
    returns: 'string',
  },
  {
    name: 'hash',
    description: trim(`
      hash(value)

      Returns a UBIGINT with the hash of the value. Note that this is not a cryptographic hash.
    `),
    url: `${duck}/text#hashvalue-`,
    args: [{name: 'value', type: 'any'}],
    returns: 'number',
  },
  ...['uuid', 'uuidv4', 'uuidv7', 'gen_random_uuid'].map(name =>
    textFunction(name, [], 'string', `${name}()\n\nGenerates a UUID.`, {
      url: `${duck}/utility`,
    }),
  ),
  textFunction('uuid_extract_timestamp', [{name: 'uuid', type: 'string'}], 'timestamp', 'uuid_extract_timestamp(uuid)\n\nExtracts the timestamp from a UUID v7 value.', {url: `${duck}/utility`}),
  textFunction('uuid_extract_version', [{name: 'uuid', type: 'string'}], 'number', 'uuid_extract_version(uuid)\n\nExtracts the UUID version.', {url: `${duck}/utility`}),

  // ============================================================================
  // Date/Time Functions (additional)
  // ============================================================================

  {
    name: 'date_trunc',
    description: trim(`
      date_trunc(part, timestamp)

      Truncate to specified precision.
    `),
    url: `${duck}/timestamp#date_truncpart-timestamp`,
    args: [
      {name: 'part', type: 'string'},
      {name: 'timestamp', type: ['date', 'timestamp']},
    ],
    returns: 'timestamp',
    metadata: args => inferGrain(args[0]?.sql),
    sqlTemplate: 'DATE_TRUNC(${part}, ${timestamp})',
  },
  {
    name: 'current_date',
    description: trim(`
      current_date

      Returns the current date.
    `),
    url: `${duck}/date#current_date`,
    args: [],
    returns: 'date',
    supportsBareInvocation: true,
  },
  {
    name: 'current_time',
    description: trim(`
      current_time

      Returns the current time.
    `),
    url: `${duck}/timestamp#current_time`,
    args: [],
    returns: 'time',
    supportsBareInvocation: true,
  },
  {
    name: 'current_timestamp',
    description: trim(`
      current_timestamp([precision])

      Returns the current timestamp (start of current transaction). Optional precision specifies the number of fractional digits.
    `),
    url: `${duck}/timestamp#current_localtimestamp`,
    args: [{name: 'precision', type: 'number?'}],
    returns: 'timestamp',
    supportsBareInvocation: true,
  },
  {
    name: 'local_timestamp',
    description: trim(`
      localtimestamp

      Returns the current timestamp (start of current transaction) in the local time zone.
    `),
    url: `${duck}/timestamp#current_localtimestamp`,
    args: [],
    returns: 'timestamp',
    sqlName: 'LOCALTIMESTAMP',
    aliases: ['localtimestamp'],
    supportsBareInvocation: true,
  },
  {
    name: 'localtime',
    description: trim(`
      localtime

      Returns the current time in the local time zone.
    `),
    url: `${duck}/timestamp#current_time`,
    args: [],
    returns: 'time',
    supportsBareInvocation: true,
  },

  // ============================================================================
  // Conditional Functions
  // ============================================================================

  {
    name: 'if',
    description: trim(`
      if(condition, trueValue, falseValue)

      Returns trueValue if condition is true, otherwise returns falseValue.
    `),
    url: `${duck}/utility`,
    args: [
      {name: 'condition', type: 'boolean'},
      {name: 'trueValue', type: 'T'},
      {name: 'falseValue', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'count_if',
    description: trim(`
      count_if(condition)

      Returns the number of rows where condition is true.
    `),
    url: `${duck}/aggregates#count_ifcondition`,
    args: [{name: 'condition', type: 'boolean'}],
    returns: 'number',
    aggregate: true,
  },
]
