import type {FieldMeta, TimeGrain, TimeOrdinal} from './types.ts'

function normalizeTemporalPart(rawPart?: string) {
  return String(rawPart || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()
}

export function inferTemporalPart(rawPart?: string): string | undefined {
  let normalized = normalizeTemporalPart(rawPart)
  if (!normalized) return

  if (/^week(?:\([a-z]+\))?$/.test(normalized)) return 'week'

  let parts: Record<string, string> = {
    dow: 'dayofweek',
    weekday: 'dayofweek',
    dayofmonth: 'day',
    doy: 'dayofyear',
    weekofyear: 'week',
    dayofweekiso: 'isodow',
    iso_dayofweek: 'isodow',
  }
  return parts[normalized] || normalized
}

export function inferTemporalGrain(rawPart?: string): TimeGrain | undefined {
  let normalized = normalizeTemporalPart(rawPart)
  if (!normalized) return

  if (/^week(?:\([a-z]+\))?$/.test(normalized) || normalized == 'isoweek') return 'week'
  if (normalized == 'isoyear') return 'year'

  let grains: Record<string, TimeGrain> = {
    year: 'year',
    quarter: 'quarter',
    month: 'month',
    day: 'day',
    hour: 'hour',
    minute: 'minute',
    second: 'second',
  }
  return grains[normalized]
}

export function inferTemporalGrainMetadata(rawPart?: string): FieldMeta | undefined {
  let timeGrain = inferTemporalGrain(rawPart)
  return timeGrain ? {timeGrain} : undefined
}

export function inferTemporalPartMetadata(rawPart?: string): FieldMeta | undefined {
  let timePart = inferTemporalPart(rawPart)
  return timePart ? {timePart} : undefined
}

export function inferTemporalOrdinal(rawPart: string | undefined, dialect: string): TimeOrdinal | undefined {
  let normalized = normalizeTemporalPart(rawPart)
  if (!normalized) return

  if (normalized == 'hour') return 'hour_of_day'
  if (normalized == 'day' || normalized == 'dayofmonth') return 'day_of_month'
  if (normalized == 'dayofyear' || normalized == 'doy') return 'day_of_year'
  if (normalized == 'week' || normalized == 'weekofyear' || normalized == 'isoweek') return 'week_of_year'
  if (normalized == 'month') return 'month_of_year'
  if (normalized == 'quarter') return 'quarter_of_year'

  if (normalized == 'isodow' || normalized == 'dayofweekiso' || normalized == 'iso_dayofweek') return 'dow_1m'

  if (normalized == 'dayofweek' || normalized == 'dow' || normalized == 'weekday') {
    if (dialect == 'bigquery') return 'dow_1s'
    if (dialect == 'clickhouse') return 'dow_1m'
    return 'dow_0s'
  }
}

export function inferTemporalOrdinalMetadata(rawPart: string | undefined, dialect: string): FieldMeta | undefined {
  let timeOrdinal = inferTemporalOrdinal(rawPart, dialect)
  return timeOrdinal ? {timeOrdinal} : undefined
}

export function inferTemporalExtractionMetadata(rawPart: string | undefined, dialect: string): FieldMeta | undefined {
  let timePart = inferTemporalPart(rawPart)
  let timeOrdinal = inferTemporalOrdinal(rawPart, dialect)
  if (!timePart && !timeOrdinal) return
  return {
    ...(timePart ? {timePart} : {}),
    ...(timeOrdinal ? {timeOrdinal} : {}),
  }
}
