<script lang="ts">
  import {onMount} from 'svelte'
  import {toBoolean} from '../component-utilities/inputUtils'

  interface Props {
    name: string
    label?: string
    title?: string
    description?: string
    start?: string | Date
    end?: string | Date
    defaultValue?: string
    presetRanges?: string | string[]
    data?: string
    dates?: string
    hideDuringPrint?: boolean | string
  }

  let {
    name, label = undefined, title = undefined, description = undefined, start = undefined,
    end = undefined, defaultValue = undefined, presetRanges = undefined, data = undefined,
    dates = undefined, hideDuringPrint = true,
  }: Props = $props()

  const DEFAULT_PRESETS = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last 365 Days', 'Last Month', 'Last Year', 'Month to Date', 'Month to Today', 'Year to Date', 'Year to Today', 'All Time']

  let mounted = false
  let queryKey = ''
  let queryHandler: ((res: {rows?: any[]; error?: any}) => void) | null = null

  let domainStart: string | null = $state(null)
  let domainEnd: string | null = $state(null)

  let currentStart: string | null = $state(null)
  let currentEnd: string | null = $state(null)
  let currentPreset: string = $state('')
  let hasExternalRange = false
  let touched = false

  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let presetList = $derived((() => {
    if (Array.isArray(presetRanges)) return presetRanges
    if (presetRanges) return [presetRanges]
    return DEFAULT_PRESETS
  })())
  let displayLabel = $derived(title || label)

  onMount(() => {
    mounted = true
    let startKey = `${name}_start`
    let endKey = `${name}_end`
    let externalStart = readParamValue(window.$GRAPHENE?.getParam?.(startKey))
    let externalEnd = readParamValue(window.$GRAPHENE?.getParam?.(endKey))
    hasExternalRange = externalStart !== undefined || externalEnd !== undefined
    currentStart = externalStart === undefined ? normalizeInput(start) : externalStart
    currentEnd = externalEnd === undefined ? normalizeInput(end) : externalEnd
    currentPreset = inferPreset(currentStart, currentEnd)
    if (hasExternalRange) updateParams()
    else if (defaultValue && presetList.includes(defaultValue)) applyPreset(defaultValue, false)
    else updateParams()
    refreshQuery()
    let unsubscribeParams = window.$GRAPHENE?.subscribeParams?.((params, event: {changed: Set<string>}) => {
      if (!event.changed.has(startKey) && !event.changed.has(endKey)) return
      applyExternalRange(params[startKey], params[endKey])
    })
    return () => {
      mounted = false
      unsubscribeParams?.()
      if (queryHandler) {
        window.$GRAPHENE?.unsubscribe?.(queryHandler)
        queryHandler = null
      }
    }
  })

  $effect(() => {
    refreshQuery()
  })

  function refreshQuery() {
    if (!mounted) return
    let key = data && dates ? `${data}::${dates}` : ''
    if (key === queryKey) return
    if (queryHandler) {
      window.$GRAPHENE?.unsubscribe?.(queryHandler)
      queryHandler = null
    }
    queryKey = key
    if (!data || !dates) return
    let handler = (res: {rows?: any[]; error?: any}) => {
      if (res.error || !res.rows?.length) return
      let values = res.rows
        .map(row => normalizeInput(row[dates]))
        .filter((val): val is string => !!val)
      if (!values.length) return
      values.sort()
      domainStart = values[0]
      domainEnd = values[values.length - 1]
      if (hasExternalRange) {
        currentPreset = inferPreset(currentStart, currentEnd)
      } else if (!touched) {
        if (defaultValue && presetList.includes(defaultValue)) {
          applyPreset(defaultValue, false)
        } else {
          let startCandidate = currentStart ?? domainStart
          let endCandidate = currentEnd ?? (domainEnd ? addDaysString(domainEnd, 1) : null)
          setRange(startCandidate, endCandidate, currentPreset, {markTouched: false, syncParam: true})
        }
      }
    }
    if (typeof window !== 'undefined' && window.$GRAPHENE?.query) {
      window.$GRAPHENE.query(data, [dates], handler)
      queryHandler = handler
    }
  }

  function normalizeInput(value: string | Date | null | undefined): string | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) return formatDate(value)
    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return formatDate(parsed)
  }

  function formatDate(value: Date): string {
    let year = value.getFullYear()
    let month = String(value.getMonth() + 1).padStart(2, '0')
    let day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function addDays(value: Date, days: number): Date {
    let copy = new Date(value) // eslint-disable-line svelte/prefer-svelte-reactivity
    copy.setDate(copy.getDate() + days)
    return copy
  }

  function addDaysString(value: string, days: number): string {
    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return formatDate(addDays(parsed, days))
  }

  function startOfMonth(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), 1)
  }

  function startOfYear(value: Date): Date {
    return new Date(value.getFullYear(), 0, 1)
  }

  function addMonths(value: Date, months: number): Date {
    let copy = new Date(value) // eslint-disable-line svelte/prefer-svelte-reactivity
    copy.setMonth(copy.getMonth() + months)
    return copy
  }

  function addYears(value: Date, years: number): Date {
    let copy = new Date(value) // eslint-disable-line svelte/prefer-svelte-reactivity
    copy.setFullYear(copy.getFullYear() + years)
    return copy
  }

  function readParamValue(rawValue: unknown): string | null | undefined {
    if (rawValue === undefined) return undefined
    if (rawValue === null) return null
    if (Array.isArray(rawValue)) return normalizeInput(rawValue[0] as string | Date | null | undefined)
    return normalizeInput(rawValue as string | Date | null | undefined)
  }

  function inferPreset(startValue: string | null, endValue: string | null): string {
    if (!startValue && !endValue) return ''
    let baseEnd = (() => {
      if (endValue) {
        let parsed = new Date(endValue)
        if (!Number.isNaN(parsed.getTime())) return addDays(parsed, -1)
      }
      if (domainEnd) return new Date(domainEnd)
      return new Date()
    })()
    if (Number.isNaN(baseEnd.getTime())) return ''
    for (let preset of presetList) {
      let range = computePresetRange(preset, baseEnd)
      let presetStart = range?.start ? formatDate(range.start) : null
      let presetEnd = range?.end ? formatDate(range.end) : null
      if (presetStart === startValue && presetEnd === endValue) return preset
    }
    return ''
  }

  function setRange(startValue: string | null, endValue: string | null, preset: string, {markTouched = false, syncParam = true}: {markTouched?: boolean; syncParam?: boolean} = {}) {
    currentStart = startValue
    currentEnd = endValue
    currentPreset = preset
    if (markTouched) touched = true
    if (syncParam) updateParams()
  }

  function updateParams() {
    window.$GRAPHENE.updateParams({
      [`${name}_start`]: currentStart,
      [`${name}_end`]: currentEnd,
    })
  }

  function applyExternalRange(startRaw: unknown, endRaw: unknown) {
    if (!mounted) return
    hasExternalRange = true
    let nextStart = readParamValue(startRaw)
    let nextEnd = readParamValue(endRaw)
    setRange(nextStart ?? null, nextEnd ?? null, inferPreset(nextStart ?? null, nextEnd ?? null), {syncParam: false})
  }

  function onStartChange(event: Event) {
    let value = (event.currentTarget as HTMLInputElement).value || null
    setRange(value, currentEnd, '', {markTouched: true, syncParam: true})
  }

  function onEndChange(event: Event) {
    let value = (event.currentTarget as HTMLInputElement).value || null
    setRange(currentStart, value, '', {markTouched: true, syncParam: true})
  }

  function applyPreset(preset: string, markTouched = true) {
    let baseEnd = (() => {
      if (currentEnd) return new Date(currentEnd)
      if (domainEnd) return new Date(domainEnd)
      return new Date()
    })()
    if (Number.isNaN(baseEnd.getTime())) baseEnd = new Date()
    let range = computePresetRange(preset, baseEnd)
    if (!range) return
    let startVal = range.start ? formatDate(range.start) : null
    let endVal = range.end ? formatDate(range.end) : null
    setRange(startVal, endVal, preset, {markTouched, syncParam: true})
  }

  function computePresetRange(preset: string, baseEndInclusive: Date): {start: Date | null; end: Date | null} | null {
    let label = preset.trim()
    let today = new Date()
    let endExclusive = addDays(baseEndInclusive, 1)

    let lastDaysMatch = label.match(/^Last (\d+) Days$/i)
    if (lastDaysMatch) {
      let days = parseInt(lastDaysMatch[1], 10)
      let startDate = addDays(endExclusive, -days)
      return {start: startDate, end: endExclusive}
    }

    let lastMonthsMatch = label.match(/^Last (\d+) Months$/i)
    if (lastMonthsMatch) {
      let months = parseInt(lastMonthsMatch[1], 10)
      let monthEnd = startOfMonth(endExclusive)
      let startDate = addMonths(monthEnd, -months)
      return {start: startDate, end: monthEnd}
    }

    if (label === 'Last Month') {
      let monthEnd = startOfMonth(endExclusive)
      let startDate = addMonths(monthEnd, -1)
      return {start: startDate, end: monthEnd}
    }

    if (label === 'Last Year') {
      let yearEnd = startOfYear(endExclusive)
      let startDate = addYears(yearEnd, -1)
      return {start: startDate, end: yearEnd}
    }

    if (label === 'Last 365 Days') {
      let startDate = addDays(endExclusive, -365)
      return {start: startDate, end: endExclusive}
    }

    if (label === 'Month to Date') {
      let startDate = startOfMonth(endExclusive)
      return {start: startDate, end: endExclusive}
    }

    if (label === 'Month to Today') {
      let startDate = startOfMonth(today)
      let endDate = addDays(today, 1)
      return {start: startDate, end: endDate}
    }

    if (label === 'Year to Date') {
      let startDate = startOfYear(endExclusive)
      return {start: startDate, end: endExclusive}
    }

    if (label === 'Year to Today') {
      let startDate = startOfYear(today)
      let endDate = addDays(today, 1)
      return {start: startDate, end: endDate}
    }

    if (label === 'All Time') {
      let startDate = domainStart ? new Date(domainStart) : null
      let endDate = domainEnd ? addDays(new Date(domainEnd), 1) : endExclusive
      return {start: startDate, end: endDate}
    }

    return null
  }

  function onPresetChange(event: Event) {
    let value = (event.currentTarget as HTMLSelectElement).value
    if (!value) {
      currentPreset = ''
      touched = true
      return
    }
    applyPreset(value, true)
  }
</script>

<div class={`input-block${hidePrint ? ' hide-print' : ''}`}>
  {#if displayLabel}
    <label class="input-label" for={`daterange-${name}-start`}>{displayLabel}</label>
  {/if}
  {#if description}
    <div class="input-description">{description}</div>
  {/if}
  <div class="range-row">
    <input id={`daterange-${name}-start`} class="date-input" type="date" value={currentStart || ''} onchange={onStartChange} />
    <span class="range-separator">to</span>
    <input id={`daterange-${name}-end`} class="date-input" type="date" value={currentEnd || ''} onchange={onEndChange} />
  </div>
  {#if presetList.length}
    <select class="preset-select" onchange={onPresetChange}>
      <option value="">Custom range</option>
      {#each presetList as preset (preset)}
        <option value={preset} selected={preset === currentPreset}>{preset}</option>
      {/each}
    </select>
  {/if}
</div>

<style>
  .input-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
  }
  @media print {
    .hide-print {
      display: none !important;
    }
  }
  .input-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--input-label-color, #374151);
  }
  .input-description {
    font-size: 12px;
    color: rgba(55, 65, 81, 0.8);
  }
  .range-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .range-separator {
    font-size: 12px;
    color: rgba(55, 65, 81, 0.9);
  }
  .date-input {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(107, 114, 128, 0.4);
    font-size: 14px;
    min-width: 150px;
    font-family: var(--ui-font-family);
    font-synthesis: none;
  }
  .preset-select {
    max-width: 220px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(107, 114, 128, 0.4);
    font-size: 13px;
    font-family: var(--ui-font-family);
    font-synthesis: none;
  }
</style>
