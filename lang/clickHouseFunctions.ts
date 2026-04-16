import type {FunctionDef} from './functionTypes.ts'

import {inferTemporalGrainMetadata} from './temporalMetadata.ts'
import {trimIndentation} from './util.ts'

const trim = trimIndentation
const click = 'https://clickhouse.com/docs/en/sql-reference'

// Keep the ClickHouse surface focused on mainstream analytics functions that map
// cleanly to Graphene's type system and SQL lowering.
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
  {
    name: 'rank',
    description: trim(`
      rank()

      Returns the rank of the current row with gaps for ties.
    `),
    url: `${click}/window-functions/rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'dense_rank',
    description: trim(`
      dense_rank()

      Returns the rank of the current row without gaps for ties.
    `),
    url: `${click}/window-functions/dense_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'percent_rank',
    description: trim(`
      percent_rank()

      Returns the relative rank of the current row in the partition.
    `),
    url: `${click}/window-functions`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'lag',
    description: trim(`
      lag(expr, offset, default)

      Returns a previous value from the window partition.
    `),
    url: `${click}/window-functions/lag`,
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
    description: trim(`
      lead(expr, offset, default)

      Returns a following value from the window partition.
    `),
    url: `${click}/window-functions/lead`,
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
    description: trim(`
      first_value(expr)

      Returns the first value in the window frame.
    `),
    url: `${click}/window-functions/first_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'last_value',
    description: trim(`
      last_value(expr)

      Returns the last value in the window frame.
    `),
    url: `${click}/window-functions/last_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'nth_value',
    description: trim(`
      nth_value(expr, nth)

      Returns the nth value in the window frame.
    `),
    url: `${click}/window-functions/nth_value`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'nth', type: 'number'},
    ],
    returns: 'T',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // ============================================================================
  {
    name: 'any',
    description: trim(`
      any(arg)

      Returns the first encountered value.
    `),
    url: `${click}/aggregate-functions/reference/any`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'anylast',
    description: trim(`
      anyLast(arg)

      Returns the last encountered value.
    `),
    url: `${click}/aggregate-functions/reference/anylast`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    sqlName: 'anyLast',
    aliases: ['any_last'],
  },
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
    name: 'avgif',
    description: trim(`
      avgIf(arg, condition)

      Computes the average of values where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'number'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'number',
    aggregate: true,
    sqlName: 'avgIf',
    aliases: ['avg_if'],
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
    name: 'countif',
    description: trim(`
      countIf(condition)

      Counts rows where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [{name: 'condition', type: 'boolean'}],
    returns: 'number',
    aggregate: true,
    sqlName: 'countIf',
    aliases: ['count_if'],
  },
  {
    name: 'grouparray',
    description: trim(`
      groupArray(arg)

      Collects the input values into an array.
    `),
    url: `${click}/aggregate-functions/reference/grouparray`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'array',
    aggregate: true,
    sqlName: 'groupArray',
    aliases: ['group_array'],
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
    name: 'maxif',
    description: trim(`
      maxIf(arg, condition)

      Returns the maximum value where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'T'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'maxIf',
    aliases: ['max_if'],
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
    name: 'minif',
    description: trim(`
      minIf(arg, condition)

      Returns the minimum value where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'T'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'minIf',
    aliases: ['min_if'],
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
  {
    name: 'sumif',
    description: trim(`
      sumIf(arg, condition)

      Sums the values where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'number'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'number',
    aggregate: true,
    sqlName: 'sumIf',
    aliases: ['sum_if'],
  },
  {
    name: 'uniq',
    description: trim(`
      uniq(arg)

      Returns an approximate number of distinct values.
    `),
    url: `${click}/aggregate-functions/reference/uniq`,
    args: [{name: 'arg', type: 'any'}],
    returns: 'number',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'uniqexact',
    description: trim(`
      uniqExact(arg)

      Returns the exact number of distinct values.
    `),
    url: `${click}/aggregate-functions/reference/uniqexact`,
    args: [{name: 'arg', type: 'any'}],
    returns: 'number',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'uniqExact',
    aliases: ['uniq_exact'],
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
    name: 'ceil',
    description: trim(`
      ceil(x)

      Rounds x up to the nearest integer.
    `),
    url: `${click}/functions/rounding-functions#ceil`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'ceiling',
    description: trim(`
      ceiling(x)

      Alias for ceil(x).
    `),
    url: `${click}/functions/rounding-functions#ceil`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    sqlName: 'ceiling',
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
  {
    name: 'greatest',
    description: trim(`
      greatest(x, ...)

      Returns the largest value from the argument list.
    `),
    url: `${click}/functions/conditional-functions#greatest`,
    args: [{name: 'values', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'least',
    description: trim(`
      least(x, ...)

      Returns the smallest value from the argument list.
    `),
    url: `${click}/functions/conditional-functions#least`,
    args: [{name: 'values', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'pow',
    description: trim(`
      pow(x, y)

      Raises x to the power y.
    `),
    url: `${click}/functions/math-functions#pow`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'y', type: 'number'},
    ],
    returns: 'number',
  },
  {
    name: 'power',
    description: trim(`
      power(x, y)

      Raises x to the power y.
    `),
    url: `${click}/functions/math-functions#pow`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'y', type: 'number'},
    ],
    returns: 'number',
  },
  {
    name: 'round',
    description: trim(`
      round(x, precision)

      Rounds x to the requested number of decimal places.
    `),
    url: `${click}/functions/rounding-functions#round`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'precision', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'sqrt',
    description: trim(`
      sqrt(x)

      Returns the square root of x.
    `),
    url: `${click}/functions/math-functions#sqrt`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },

  // ============================================================================
  // String Functions
  // ============================================================================
  {
    name: 'concat',
    description: trim(`
      concat(arg, ...)

      Concatenates the input strings.
    `),
    url: `${click}/functions/string-functions#concat`,
    args: [{name: 'values', type: 'string...'}],
    returns: 'string',
  },
  {
    name: 'endswith',
    description: trim(`
      endsWith(string, suffix)

      Returns true when string ends with suffix.
    `),
    url: `${click}/functions/string-functions#endswith`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'suffix', type: 'string'},
    ],
    returns: 'boolean',
    sqlName: 'endsWith',
    aliases: ['ends_with'],
  },
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
    name: 'match',
    description: trim(`
      match(string, pattern)

      Returns true when the string matches the regular expression.
    `),
    url: `${click}/functions/string-search-functions#match`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'pattern', type: 'string'},
    ],
    returns: 'boolean',
  },
  {
    name: 'position',
    description: trim(`
      position(string, substring)

      Returns the 1-based position of the substring.
    `),
    url: `${click}/functions/string-search-functions#position`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'substring', type: 'string'},
    ],
    returns: 'number',
  },
  {
    name: 'replace',
    description: trim(`
      replaceAll(string, pattern, replacement)

      Replaces every occurrence of pattern in string.
    `),
    url: `${click}/functions/string-replace-functions#replaceall`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'replacement', type: 'string'},
    ],
    returns: 'string',
    sqlName: 'replaceAll',
  },
  {
    name: 'splitbychar',
    description: trim(`
      splitByChar(sep, string)

      Splits the string by a single-character separator.
    `),
    url: `${click}/functions/splitting-merging-functions#splitbychar`,
    args: [
      {name: 'separator', type: 'string'},
      {name: 'string', type: 'string'},
    ],
    returns: 'array',
    sqlName: 'splitByChar',
    aliases: ['split_by_char'],
  },
  {
    name: 'startswith',
    description: trim(`
      startsWith(string, prefix)

      Returns true when string starts with prefix.
    `),
    url: `${click}/functions/string-functions#startswith`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'prefix', type: 'string'},
    ],
    returns: 'boolean',
    sqlName: 'startsWith',
    aliases: ['starts_with'],
  },
  {
    name: 'substring',
    description: trim(`
      substring(string, offset, length)

      Returns a substring starting at the requested position.
    `),
    url: `${click}/functions/string-functions#substring`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'offset', type: 'number'},
      {name: 'length', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'trim',
    description: trim(`
      trim(string)

      Removes leading and trailing whitespace.
    `),
    url: `${click}/functions/string-functions#trim`,
    args: [{name: 'string', type: 'string'}],
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
  // Conditional and Null Functions
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
    name: 'if',
    description: trim(`
      if(condition, then, else)

      Returns then when the condition is true, otherwise returns else.
    `),
    url: `${click}/functions/conditional-functions#if`,
    args: [
      {name: 'condition', type: 'boolean'},
      {name: 'then', type: 'T'},
      {name: 'else', type: 'T'},
    ],
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
    name: 'multiif',
    description: trim(`
      multiIf(cond1, then1, cond2, then2, else)

      Evaluates the conditions in order and returns the matching branch.
    `),
    url: `${click}/functions/conditional-functions#multiif`,
    args: [{name: 'branches', type: 'T...'}],
    returns: 'T',
    sqlName: 'multiIf',
    aliases: ['multi_if'],
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
    metadata: args => inferTemporalGrainMetadata(args[0]?.sql),
    sqlTemplate: 'DATE_TRUNC(${date_part}, ${datetime})',
  },
  {
    name: 'formatdatetime',
    description: trim(`
      formatDateTime(datetime, format)

      Formats a date or timestamp as a string.
    `),
    url: `${click}/functions/date-time-functions#formatdatetime`,
    args: [
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'format', type: 'string'},
    ],
    returns: 'string',
    sqlName: 'formatDateTime',
    aliases: ['format_datetime'],
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
    name: 'parsedatetimebesteffort',
    description: trim(`
      parseDateTimeBestEffort(text)

      Parses a string into a timestamp using ClickHouse's best-effort parser.
    `),
    url: `${click}/functions/type-conversion-functions#parsedatetimebesteffort`,
    args: [{name: 'text', type: 'string'}],
    returns: 'timestamp',
    sqlName: 'parseDateTimeBestEffort',
    aliases: ['parse_datetime_best_effort'],
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
  {
    name: 'todate',
    description: trim(`
      toDate(value)

      Converts the value to a date.
    `),
    url: `${click}/functions/type-conversion-functions#todate`,
    args: [{name: 'value', type: ['string', 'date', 'timestamp', 'number']}],
    returns: 'date',
    sqlName: 'toDate',
    aliases: ['to_date'],
  },
  {
    name: 'todatetime',
    description: trim(`
      toDateTime(value)

      Converts the value to a timestamp.
    `),
    url: `${click}/functions/type-conversion-functions#todatetime`,
    args: [{name: 'value', type: ['string', 'date', 'timestamp', 'number']}],
    returns: 'timestamp',
    sqlName: 'toDateTime',
    aliases: ['to_datetime'],
  },
  {
    name: 'todayofmonth',
    description: trim(`
      toDayOfMonth(datetime)

      Extracts the day of the month.
    `),
    url: `${click}/functions/date-time-functions#todayofmonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: {timeOrdinal: 'day_of_month'},
    sqlName: 'toDayOfMonth',
    aliases: ['to_day_of_month'],
  },
  {
    name: 'todayofweek',
    description: trim(`
      toDayOfWeek(datetime)

      Extracts the day of the week.
    `),
    url: `${click}/functions/date-time-functions#todayofweek`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: {timeOrdinal: 'dow_1m'},
    sqlName: 'toDayOfWeek',
    aliases: ['to_day_of_week'],
  },
  {
    name: 'tohour',
    description: trim(`
      toHour(datetime)

      Extracts the hour.
    `),
    url: `${click}/functions/date-time-functions#tohour`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: {timeOrdinal: 'hour_of_day'},
    sqlName: 'toHour',
    aliases: ['to_hour'],
  },
  {
    name: 'tominute',
    description: trim(`
      toMinute(datetime)

      Extracts the minute.
    `),
    url: `${click}/functions/date-time-functions#tominute`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    sqlName: 'toMinute',
    aliases: ['to_minute'],
  },
  {
    name: 'tomonth',
    description: trim(`
      toMonth(datetime)

      Extracts the month number.
    `),
    url: `${click}/functions/date-time-functions#tomonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: {timeOrdinal: 'month_of_year'},
    sqlName: 'toMonth',
    aliases: ['to_month'],
  },
  {
    name: 'tosecond',
    description: trim(`
      toSecond(datetime)

      Extracts the second.
    `),
    url: `${click}/functions/date-time-functions#tosecond`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    sqlName: 'toSecond',
    aliases: ['to_second'],
  },
  {
    name: 'tostartofday',
    description: trim(`
      toStartOfDay(datetime)

      Truncates to the start of the day.
    `),
    url: `${click}/functions/date-time-functions#tostartofday`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'day'},
    sqlName: 'toStartOfDay',
    aliases: ['to_start_of_day'],
  },
  {
    name: 'tostartofmonth',
    description: trim(`
      toStartOfMonth(datetime)

      Truncates to the start of the month.
    `),
    url: `${click}/functions/date-time-functions#tostartofmonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'month'},
    sqlName: 'toStartOfMonth',
    aliases: ['to_start_of_month'],
  },
  {
    name: 'tostartofquarter',
    description: trim(`
      toStartOfQuarter(datetime)

      Truncates to the start of the quarter.
    `),
    url: `${click}/functions/date-time-functions#tostartofquarter`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'quarter'},
    sqlName: 'toStartOfQuarter',
    aliases: ['to_start_of_quarter'],
  },
  {
    name: 'tostartofweek',
    description: trim(`
      toStartOfWeek(datetime)

      Truncates to the start of the week.
    `),
    url: `${click}/functions/date-time-functions#tostartofweek`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'week'},
    sqlName: 'toStartOfWeek',
    aliases: ['to_start_of_week'],
  },
  {
    name: 'tostartofyear',
    description: trim(`
      toStartOfYear(datetime)

      Truncates to the start of the year.
    `),
    url: `${click}/functions/date-time-functions#tostartofyear`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'year'},
    sqlName: 'toStartOfYear',
    aliases: ['to_start_of_year'],
  },
  {
    name: 'toyear',
    description: trim(`
      toYear(datetime)

      Extracts the year number.
    `),
    url: `${click}/functions/date-time-functions#toyear`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    sqlName: 'toYear',
    aliases: ['to_year'],
  },
]
