<script lang="ts">
  import {onMount} from 'svelte'
  import {toBoolean} from '../component-utilities/inputUtils'
  import {DEFAULT_DATE_PRESETS, addDays, computeDatePresetRange, formatDate, normalizeDateInput} from '../component-utilities/pageInputDefaults.ts'
  import {captureInitial, getPageInputs} from '../internal/pageInputs.svelte.ts'

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

  let mounted = false
  let queryKey = ''
  let queryHandler: ((res: {rows?: any[]; error?: any}) => void) | null = null
  let pageInputs = getPageInputs()
  let field = captureInitial(() => pageInputs.dateRange(name))

  let domainStart: string | null = $state(null)
  let domainEnd: string | null = $state(null)

  let currentStart: string | null = $state(null)
  let currentEnd: string | null = $state(null)
  let currentPreset: string | null = $state(null)
  let touched = false

  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let presetList = $derived((() => {
    if (Array.isArray(presetRanges)) return presetRanges
    if (presetRanges) return [presetRanges]
    return DEFAULT_DATE_PRESETS
  })())
  let displayLabel = $derived(title || label)

  onMount(() => {
    mounted = true
    currentStart = field.hasExternalValue ? field.value.start : normalizeDateInput(start)
    currentEnd = field.hasExternalValue ? field.value.end : normalizeDateInput(end)
    currentPreset = inferPreset(currentStart, currentEnd)
    if (field.hasExternalValue) updateParams()
    else if (defaultValue && presetList.includes(defaultValue)) applyPreset(defaultValue, false)
    else updateParams()
    refreshQuery()
    return () => {
      mounted = false
      field.destroy()
      if (queryHandler) {
        window.$GRAPHENE?.unsubscribe?.(queryHandler)
        queryHandler = null
      }
    }
  })

  $effect(() => {
    refreshQuery()
  })

  $effect(() => {
    if (currentStart === field.value.start && currentEnd === field.value.end) return
    if (!mounted) return
    setRange(field.value.start, field.value.end, inferPreset(field.value.start, field.value.end), {persist: false})
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
      if (!res || res.error || !res.rows?.length) return
      let values = res.rows
        .map(row => normalizeDateInput(row[dates]))
        .filter((val): val is string => !!val)
      if (!values.length) return
      values.sort()
      domainStart = values[0]
      domainEnd = values[values.length - 1]
      if (field.hasExternalValue) {
        currentPreset = inferPreset(currentStart, currentEnd)
      } else if (!touched) {
        if (defaultValue && presetList.includes(defaultValue)) {
          applyPreset(defaultValue, false)
        } else {
          let startCandidate = currentStart ?? domainStart
          let endCandidate = currentEnd ?? (domainEnd ? addDaysString(domainEnd, 1) : null)
          setRange(startCandidate, endCandidate, currentPreset, {markTouched: false, persist: true})
        }
      }
    }
    if (typeof window !== 'undefined' && window.$GRAPHENE?.query) {
      window.$GRAPHENE.query(data, [dates], handler)
      queryHandler = handler
    }
  }

  function addDaysString(value: string, days: number): string {
    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return formatDate(addDays(parsed, days))
  }

  // We only persist start/end in URL state, so the preset label is inferred by matching
  // the current range against the configured preset definitions.
  function inferPreset(startValue: string | null, endValue: string | null): string | null {
    if (!startValue && !endValue) return null
    let baseEnd = (() => {
      if (endValue) {
        let parsed = new Date(endValue)
        if (!Number.isNaN(parsed.getTime())) return addDays(parsed, -1)
      }
      if (domainEnd) return new Date(domainEnd)
      return new Date()
    })()
    if (Number.isNaN(baseEnd.getTime())) return null
    for (let preset of presetList) {
      let range = computeDatePresetRange(preset, baseEnd, {domainStart, domainEnd})
      let presetStart = range?.start ? formatDate(range.start) : null
      let presetEnd = range?.end ? formatDate(range.end) : null
      if (presetStart === startValue && presetEnd === endValue) return preset
    }
    return null
  }

  function setRange(startValue: string | null, endValue: string | null, preset: string | null, {markTouched = false, persist = true}: {markTouched?: boolean; persist?: boolean} = {}) {
    currentStart = startValue
    currentEnd = endValue
    currentPreset = preset
    if (markTouched) touched = true
    if (persist) updateParams()
  }

  function updateParams() {
    field.set({start: currentStart, end: currentEnd})
  }

  function onStartChange(event: Event) {
    let value = (event.currentTarget as HTMLInputElement).value || null
    setRange(value, currentEnd, null, {markTouched: true, persist: true})
  }

  function onEndChange(event: Event) {
    let value = (event.currentTarget as HTMLInputElement).value || null
    setRange(currentStart, value, null, {markTouched: true, persist: true})
  }

  function applyPreset(preset: string, markTouched = true) {
    let baseEnd = (() => {
      if (currentEnd) return new Date(currentEnd)
      if (domainEnd) return new Date(domainEnd)
      return new Date()
    })()
    if (Number.isNaN(baseEnd.getTime())) baseEnd = new Date()
    let range = computeDatePresetRange(preset, baseEnd, {domainStart, domainEnd})
    if (!range) return
    let startVal = range.start ? formatDate(range.start) : null
    let endVal = range.end ? formatDate(range.end) : null
    setRange(startVal, endVal, preset, {markTouched, persist: true})
  }

  function onPresetChange(event: Event) {
    let value = (event.currentTarget as HTMLSelectElement).value
    if (!value) {
      currentPreset = null
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
    font-family: var(--font-ui);
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
    font-family: var(--font-ui);
    font-synthesis: none;
  }
  .preset-select {
    max-width: 220px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(107, 114, 128, 0.4);
    font-size: 13px;
    font-family: var(--font-ui);
    font-synthesis: none;
  }
</style>
