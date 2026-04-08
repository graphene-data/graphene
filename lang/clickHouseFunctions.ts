import type {FunctionDef} from './functionTypes.ts'

import {trimIndentation} from './util.ts'

const trim = trimIndentation
const click = 'https://clickhouse.com/docs/en/sql-reference'

// Keep this catalog intentionally small for the MVP. Every function listed here
// should be one we want to advertise as supported for ClickHouse today, with a
// matching ClickHouse docs URL rather than an inherited warehouse reference.
export const clickHouseFunctions: FunctionDef[] = [
  // ============================================================================
  // Window Functions
  // ============================================================================
  {
    name: 'row_number',
    description: trim(`
      row_number()

      Numbers the current row within its window partition.
    `),
    url: `${click}/window-functions/row_number`,
    args: [],
    returns: 'number',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // ============================================================================
  {
    name: 'avg',
    description: trim(`
      avg(arg)

      Computes the arithmetic mean of the input values.
    `),
    url: `${click}/aggregate-functions/reference/avg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'count',
    description: trim(`
      count(arg)

      Counts rows, or the non-null values of arg when an argument is provided.
    `),
    url: `${click}/aggregate-functions/reference/count`,
    args: [{name: 'arg', type: 'any?'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'max',
    description: trim(`
      max(arg)

      Returns the maximum value of arg.
    `),
    url: `${click}/aggregate-functions/reference/max`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'min',
    description: trim(`
      min(arg)

      Returns the minimum value of arg.
    `),
    url: `${click}/aggregate-functions/reference/min`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'sum',
    description: trim(`
      sum(arg)

      Sums the numeric input values.
    `),
    url: `${click}/aggregate-functions/reference/sum`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },

  // ============================================================================
  // Numeric Functions
  // ============================================================================
  {
    name: 'abs',
    description: trim(`
      abs(x)

      Returns the absolute value of x.
    `),
    url: `${click}/functions/arithmetic-functions#abs`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'floor',
    description: trim(`
      floor(x)

      Rounds x down to the nearest integer.
    `),
    url: `${click}/functions/rounding-functions#floor`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },

  // ============================================================================
  // String Functions
  // ============================================================================
  {
    name: 'length',
    description: trim(`
      length(s)

      Returns the length of the string.
    `),
    url: `${click}/functions/string-functions#length`,
    args: [{name: 's', type: 'string'}],
    returns: 'number',
  },
  {
    name: 'lower',
    description: trim(`
      lower(s)

      Converts the string to lowercase.
    `),
    url: `${click}/functions/string-functions#lower`,
    args: [{name: 's', type: 'string'}],
    returns: 'string',
  },
  {
    name: 'upper',
    description: trim(`
      upper(s)

      Converts the string to uppercase.
    `),
    url: `${click}/functions/string-functions#upper`,
    args: [{name: 's', type: 'string'}],
    returns: 'string',
  },

  // ============================================================================
  // Null Handling
  // ============================================================================
  {
    name: 'coalesce',
    description: trim(`
      coalesce(expr, ...)

      Returns the first non-null expression from the argument list.
    `),
    url: `${click}/functions/functions-for-nulls#coalesce`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'ifnull',
    description: trim(`
      ifNull(x, alt)

      Returns x when it is not null, otherwise returns alt.
    `),
    url: `${click}/functions/functions-for-nulls#ifnull`,
    args: [
      {name: 'x', type: 'T'},
      {name: 'alt', type: 'T'},
    ],
    returns: 'T',
    sqlName: 'ifNull',
  },
  {
    name: 'nullif',
    description: trim(`
      nullIf(x, y)

      Returns null when x equals y, otherwise returns x.
    `),
    url: `${click}/functions/functions-for-nulls#nullif`,
    args: [
      {name: 'x', type: 'T'},
      {name: 'y', type: 'T'},
    ],
    returns: 'T',
    sqlName: 'nullIf',
  },

  // ============================================================================
  // Date and Time Functions
  // ============================================================================
  {
    name: 'date_diff',
    description: trim(`
      date_diff(unit, start, end)

      Returns the difference between two dates or timestamps in the requested unit.
    `),
    url: `${click}/functions/date-time-functions#date_diff`,
    args: [
      {name: 'unit', type: 'string'},
      {name: 'start', type: ['date', 'timestamp']},
      {name: 'end', type: ['date', 'timestamp']},
    ],
    returns: 'number',
  },
  {
    name: 'date_trunc',
    description: trim(`
      date_trunc(unit, datetime)

      Truncates a date or timestamp to the requested precision.
    `),
    url: `${click}/functions/date-time-functions#datetrunc`,
    args: [
      {name: 'date_part', type: 'string'},
      {name: 'datetime', type: ['date', 'timestamp']},
    ],
    returns: 'timestamp',
    sqlTemplate: 'DATE_TRUNC(${date_part}, ${datetime})',
  },
  {
    name: 'current_date',
    description: trim(`
      current_date()

      Returns the current date.
    `),
    url: `${click}/functions/date-time-functions#current_date`,
    args: [],
    returns: 'date',
  },
  {
    name: 'current_timestamp',
    description: trim(`
      current_timestamp()

      Returns the current timestamp.
    `),
    url: `${click}/functions/date-time-functions#now`,
    args: [],
    returns: 'timestamp',
  },
  {
    name: 'now',
    description: trim(`
      now()

      Returns the current timestamp.
    `),
    url: `${click}/functions/date-time-functions#now`,
    args: [],
    returns: 'timestamp',
  },
  {
    name: 'today',
    description: trim(`
      today()

      Returns the current date.
    `),
    url: `${click}/functions/date-time-functions#today`,
    args: [],
    returns: 'date',
  },
]
