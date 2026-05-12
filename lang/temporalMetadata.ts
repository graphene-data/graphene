import type {FieldMeta, TimeOrdinal} from './types.ts'

function normalizeTemporalPart(rawPart?: string) {
  return String(rawPart || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()
}

// Metadata for truncation/binning functions. The result remains temporal (date/timestamp),
// so the part describes display resolution rather than an extracted number.
export function inferGrain(rawPart?: string): FieldMeta | undefined {
  let normalized = normalizeTemporalPart(rawPart)
  if (!normalized) return

  if (/^week(?:\([a-z]+\))?$/.test(normalized) || normalized == 'isoweek') return {timeGrain: 'week', defaultName: 'week'}
  if (normalized == 'isoyear') return {timeGrain: 'year', defaultName: 'year'}

  switch (normalized) {
    case 'year':
    case 'quarter':
    case 'month':
    case 'day':
    case 'hour':
    case 'minute':
    case 'second':
      return {timeGrain: normalized, defaultName: normalized}
  }
}

// Metadata for extraction functions like extract/date_part/hour(...). Most extracted
// values are bounded ordinals (month-of-year, day-of-week, etc). Year is the exception:
// it is unbounded, so we treat it as a numeric value at year grain instead of an ordinal.
export function inferTimeOrdinal(rawPart: string | undefined, dialect: string): FieldMeta | undefined {
  let normalized = normalizeTemporalPart(rawPart)
  if (normalized == 'year' || normalized == 'isoyear') return {timeGrain: 'year', defaultName: 'year'}

  let timeOrdinal: TimeOrdinal | undefined
  if (normalized == 'hour') timeOrdinal = 'hour_of_day'
  if (normalized == 'day' || normalized == 'dayofmonth') timeOrdinal = 'day_of_month'
  if (normalized == 'dayofyear' || normalized == 'doy') timeOrdinal = 'day_of_year'
  if (normalized == 'week' || normalized == 'weekofyear' || normalized == 'isoweek' || /^week(?:\([a-z]+\))?$/.test(normalized)) timeOrdinal = 'week_of_year'
  if (normalized == 'month') timeOrdinal = 'month_of_year'
  if (normalized == 'quarter') timeOrdinal = 'quarter_of_year'
  if (normalized == 'isodow' || normalized == 'dayofweekiso' || normalized == 'iso_dayofweek') timeOrdinal = 'dow_1m'

  if (normalized == 'dayofweek' || normalized == 'dow' || normalized == 'weekday') {
    if (dialect == 'bigquery') timeOrdinal = 'dow_1s'
    else if (dialect == 'clickhouse') timeOrdinal = 'dow_1m'
    else timeOrdinal = 'dow_0s'
  }

  if (!timeOrdinal) return
  if (/^week(?:\([a-z]+\))?$/.test(normalized)) return {timeOrdinal, defaultName: 'week'}

  let defaultNames: Record<string, string> = {
    dow: 'dayofweek',
    weekday: 'dayofweek',
    dayofmonth: 'day',
    doy: 'dayofyear',
    weekofyear: 'week',
    dayofweekiso: 'isodow',
    iso_dayofweek: 'isodow',
  }
  return {timeOrdinal, defaultName: defaultNames[normalized] || normalized}
}
