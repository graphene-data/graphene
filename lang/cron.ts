// Shared UTC schedules for frontmatter and alerts. Validation and matching use the same five-field parser.

export const scheduleAliases: Record<string, string> = {hourly: '0 * * * *', daily: '0 0 * * *', weekly: '0 0 * * 1'}

// Expand shorthand and validate before storing a schedule.
export function normalizeCron(schedule: string): string {
  let cron = scheduleAliases[schedule] || schedule.trim().split(/\s+/).join(' ')
  parseCronFieldSet(cron)
  return cron
}

// Supports normal five-field cron syntax: wildcards, lists, ranges, and steps. Dates are evaluated in UTC.
export function cronMatches(cron: string, date: Date) {
  let [minute, hour, dayOfMonth, month, dayOfWeek] = parseCronFieldSet(scheduleAliases[cron] || cron)
  let dayOfMonthMatches = dayOfMonth.values.has(date.getUTCDate())
  let dayOfWeekMatches = dayOfWeek.values.has(date.getUTCDay())
  let dayMatches = !dayOfMonth.restricted || !dayOfWeek.restricted
    ? dayOfMonthMatches && dayOfWeekMatches
    : dayOfMonthMatches || dayOfWeekMatches
  return minute.values.has(date.getUTCMinutes()) && hour.values.has(date.getUTCHours()) && month.values.has(date.getUTCMonth() + 1) && dayMatches
}

// Expand cron fields for frontmatter validation and Cloud's UTC schedule matching.
export function parseCronFieldSet(cron: string) {
  let fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`Invalid cron "${cron}": expected five fields`)
  return [
    parseCronField(fields[0], 0, 59),
    parseCronField(fields[1], 0, 23),
    parseCronField(fields[2], 1, 31),
    parseCronField(fields[3], 1, 12),
    parseCronField(fields[4], 0, 7, true),
  ] as const
}

// Expand a field into its allowed values; a complete range is equivalent to a wildcard.
function parseCronField(field: string, min: number, max: number, sunday = false) {
  let values = new Set<number>()
  for (let part of field.split(',')) {
    if (!/^(?:\*|\d+|\d+-\d+)(?:\/\d+)?$/.test(part)) throw new Error(`Invalid cron field "${field}"`)
    let [range, rawStep] = part.split('/')
    let step = rawStep === undefined ? 1 : Number(rawStep)
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron field "${field}"`)

    let start: number
    let end: number
    if (range === '*') [start, end] = [min, max]
    else if (range.includes('-')) [start, end] = range.split('-').map(Number)
    else [start, end] = [Number(range), rawStep === undefined ? Number(range) : max]
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw new Error(`Invalid cron field "${field}"`)
    for (let value = start; value <= end; value += step) values.add(sunday && value === 7 ? 0 : value)
  }
  return {values, restricted: values.size !== (sunday ? 7 : max - min + 1)}
}

