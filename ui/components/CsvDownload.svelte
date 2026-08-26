<script lang="ts">
  import {rowsToCsv} from '../../lang/csv.ts'
  import type {QueryResult} from '../component-utilities/types.ts'
  import ActionButton from './ActionButton.svelte'

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

<ActionButton type="button" aria-label="Download chart data as CSV" title="Download chart data as CSV" onclick={downloadCsv}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
</ActionButton>
