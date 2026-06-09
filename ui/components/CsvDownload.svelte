<script lang="ts">
  import {rowsToCsv} from '../../lang/csv.ts'
  import type {QueryResult} from '../component-utilities/types.ts'

  interface Props {
    data: QueryResult
    exportId: string
    title?: string
  }

  let {data, exportId, title = undefined}: Props = $props()

  $effect(() => {
    if (data.error) return
    window.$GRAPHENE.chartExports ||= {}
    window.$GRAPHENE.chartExports[exportId] = {rows: data.rows || [], fields: data.fields || []}
    return () => {
      delete window.$GRAPHENE.chartExports?.[exportId]
    }
  })

  function downloadCsv() {
    if (data.error) return

    let csv = rowsToCsv(data.rows || [], data.fields || [])
    let blob = new Blob([csv], {type: 'text/csv;charset=utf-8'})
    let url = URL.createObjectURL(blob)
    let link = document.createElement('a')
    link.href = url
    link.download = `${csvFileName(title || exportId || 'graphene-chart')}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function csvFileName(value: string) {
    let normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return normalized || 'graphene-chart'
  }
</script>

<button class="csv-download" type="button" aria-label="Download chart data as CSV" title="Download chart data as CSV" onclick={downloadCsv}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
</button>

<style>
  .csv-download {
    position: absolute;
    top: -0.375rem;
    right: 1rem;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    color: #6b7280;
    background: transparent;
    border: 0;
    border-radius: 0.375rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease;
  }

  :global(.echarts:hover) .csv-download,
  :global(.echarts:focus-within) .csv-download,
  .csv-download:hover,
  .csv-download:focus-visible {
    opacity: 1;
  }

  .csv-download:hover,
  .csv-download:focus-visible {
    color: #111827;
  }

  .csv-download:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .csv-download svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
