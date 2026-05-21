import type {FunctionDef} from './functionTypes.ts'

import {inferGrain, inferTimeOrdinal} from './temporalMetadata.ts'

const pg = 'https://www.postgresql.org/docs/current/functions'

function fn(def: Omit<FunctionDef, 'description' | 'url'> & {description?: string; url?: string}): FunctionDef {
  return {
    description: def.description || `${def.name}(${def.args.map(arg => (Array.isArray(arg) ? arg[0] : arg.name)).join(', ')})`,
    url: def.url || pg,
    ...def,
  }
}

function windowFunction(name: string, args: FunctionDef['args'] = []): FunctionDef {
  return fn({name, args, returns: 'number', window: true, url: `${pg}-window.html`})
}

function aggregate(name: string, args: FunctionDef['args'], returns: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return fn({name, args, returns, aggregate: true, url: `${pg}-aggregate.html`, ...opts})
}

function scalar(name: string, args: FunctionDef['args'], returns: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return fn({name, args, returns, url: `${pg}.html`, ...opts})
}

function extractPart(name: string, part = name): FunctionDef {
  return scalar(name, [{name: 'date', type: ['date', 'timestamp']}], 'number', {
    url: `${pg}-datetime.html`,
    sqlTemplate: `EXTRACT(${part} FROM \${date})`,
    metadata: inferTimeOrdinal(part, 'postgres'),
  })
}

export const postgresFunctions: FunctionDef[] = [
  windowFunction('row_number', []),
  windowFunction('rank', []),
  windowFunction('dense_rank', []),
  windowFunction('ntile', [{name: 'num_buckets', type: 'number'}]),
  fn({
    name: 'lag',
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
    url: `${pg}-window.html`,
  }),
  fn({
    name: 'lead',
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
    url: `${pg}-window.html`,
  }),
  fn({name: 'first_value', args: [{name: 'expr', type: 'T'}], returns: 'T', window: true, url: `${pg}-window.html`}),
  fn({name: 'last_value', args: [{name: 'expr', type: 'T'}], returns: 'T', window: true, url: `${pg}-window.html`}),
  fn({
    name: 'nth_value',
    args: [
      {name: 'expr', type: 'T'},
      {name: 'nth', type: 'number'},
    ],
    returns: 'T',
    window: true,
    url: `${pg}-window.html`,
  }),
  windowFunction('percent_rank', []),
  windowFunction('cume_dist', []),

  aggregate('avg', [{name: 'arg', type: 'number'}], 'number'),
  aggregate('bit_and', [{name: 'arg', type: 'number'}], 'number'),
  aggregate('bit_or', [{name: 'arg', type: 'number'}], 'number'),
  aggregate('bool_and', [{name: 'arg', type: 'boolean'}], 'boolean', {fanoutSafe: true, aliases: ['every']}),
  aggregate('bool_or', [{name: 'arg', type: 'boolean'}], 'boolean', {fanoutSafe: true}),
  aggregate('count', [{name: 'arg', type: 'any?'}], 'number'),
  aggregate('count_if', [{name: 'condition', type: 'boolean'}], 'number', {sqlTemplate: 'COUNT(*) FILTER (WHERE ${condition})'}),
  aggregate('max', [{name: 'arg', type: 'T'}], 'T', {fanoutSafe: true}),
  aggregate('min', [{name: 'arg', type: 'T'}], 'T', {fanoutSafe: true}),
  aggregate('sum', [{name: 'arg', type: 'number'}], 'number'),
  aggregate('array_agg', [{name: 'arg', type: 'T'}], 'array', {aliases: ['list']}),
  aggregate(
    'string_agg',
    [
      {name: 'arg', type: 'string'},
      {name: 'sep', type: 'string'},
    ],
    'string',
  ),
  aggregate(
    'corr',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'covar_pop',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'covar_samp',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_avgx',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_avgy',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_count',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_intercept',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_r2',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_slope',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_sxx',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_sxy',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate(
    'regr_syy',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  aggregate('stddev_pop', [{name: 'x', type: 'number'}], 'number'),
  aggregate('stddev_samp', [{name: 'x', type: 'number'}], 'number'),
  aggregate('var_pop', [{name: 'x', type: 'number'}], 'number'),
  aggregate('var_samp', [{name: 'x', type: 'number'}], 'number'),

  ...[
    'abs',
    'acos',
    'acosh',
    'asin',
    'asinh',
    'atan',
    'atanh',
    'cbrt',
    'ceil',
    'ceiling',
    'cos',
    'cot',
    'degrees',
    'exp',
    'floor',
    'ln',
    'log',
    'radians',
    'round',
    'sign',
    'sin',
    'sqrt',
    'tan',
    'trunc',
  ].map(name => scalar(name, [{name: 'x', type: 'number'}], 'number')),
  scalar(
    'atan2',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  scalar(
    'mod',
    [
      {name: 'y', type: 'number'},
      {name: 'x', type: 'number'},
    ],
    'number',
  ),
  scalar(
    'power',
    [
      {name: 'base', type: 'number'},
      {name: 'exponent', type: 'number'},
    ],
    'number',
  ),
  scalar('random', [], 'number'),
  scalar('pi', [], 'number'),

  ...['lower', 'upper', 'initcap', 'md5', 'reverse', 'trim', 'ltrim', 'rtrim'].map(name => scalar(name, [{name: 'string', type: 'string'}], 'string')),
  scalar('length', [{name: 'string', type: 'string'}], 'number'),
  scalar('char_length', [{name: 'string', type: 'string'}], 'number'),
  scalar('concat', [{name: 'value', type: 'any...'}], 'string'),
  scalar(
    'left',
    [
      {name: 'string', type: 'string'},
      {name: 'n', type: 'number'},
    ],
    'string',
  ),
  scalar(
    'right',
    [
      {name: 'string', type: 'string'},
      {name: 'n', type: 'number'},
    ],
    'string',
  ),
  scalar(
    'replace',
    [
      {name: 'string', type: 'string'},
      {name: 'from', type: 'string'},
      {name: 'to', type: 'string'},
    ],
    'string',
  ),
  scalar(
    'split_part',
    [
      {name: 'string', type: 'string'},
      {name: 'delimiter', type: 'string'},
      {name: 'field', type: 'number'},
    ],
    'string',
  ),
  scalar(
    'starts_with',
    [
      {name: 'string', type: 'string'},
      {name: 'prefix', type: 'string'},
    ],
    'boolean',
  ),
  scalar(
    'regexp_replace',
    [
      {name: 'string', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'replacement', type: 'string'},
    ],
    'string',
  ),

  scalar(
    'date_part',
    [
      {name: 'part', type: 'string'},
      {name: 'date', type: ['date', 'timestamp']},
    ],
    'number',
    {
      url: `${pg}-datetime.html`,
      metadata: args => inferTimeOrdinal(args[0]?.sql, 'postgres'),
    },
  ),
  scalar(
    'date_trunc',
    [
      {name: 'part', type: 'string'},
      {name: 'timestamp', type: ['date', 'timestamp']},
    ],
    'timestamp',
    {
      url: `${pg}-datetime.html`,
      metadata: args => inferGrain(args[0]?.sql),
      sqlTemplate: 'DATE_TRUNC(${part},${timestamp})',
    },
  ),
  extractPart('year'),
  extractPart('quarter'),
  extractPart('month'),
  extractPart('week'),
  extractPart('day', 'day'),
  extractPart('hour'),
  extractPart('minute'),
  extractPart('second'),
  extractPart('dayofweek', 'dow'),
  extractPart('dayofmonth', 'day'),
  extractPart('dayofyear', 'doy'),
  extractPart('isodow'),
  extractPart('isoyear'),
  fn({name: 'current_date', args: [], returns: 'date', sqlName: 'CURRENT_DATE', sqlTemplate: 'CURRENT_DATE', supportsBareInvocation: true, url: `${pg}-datetime.html`}),
  fn({name: 'current_time', args: [], returns: 'timestamp', sqlName: 'CURRENT_TIME', sqlTemplate: 'CURRENT_TIME', supportsBareInvocation: true, url: `${pg}-datetime.html`}),
  fn({name: 'current_timestamp', args: [], returns: 'timestamp', sqlName: 'CURRENT_TIMESTAMP', sqlTemplate: 'CURRENT_TIMESTAMP', supportsBareInvocation: true, url: `${pg}-datetime.html`}),
  fn({name: 'localtime', args: [], returns: 'timestamp', sqlName: 'LOCALTIME', sqlTemplate: 'LOCALTIME', supportsBareInvocation: true, url: `${pg}-datetime.html`}),
  fn({
    name: 'local_timestamp',
    args: [],
    returns: 'timestamp',
    sqlName: 'LOCALTIMESTAMP',
    sqlTemplate: 'LOCALTIMESTAMP',
    aliases: ['localtimestamp'],
    supportsBareInvocation: true,
    url: `${pg}-datetime.html`,
  }),
]
