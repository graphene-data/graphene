import './app.css'
import {isLoading} from './internal/queryEngine.ts'

export {default as Area} from './components/Area.svelte'
export {default as AreaChart} from './components/AreaChart.svelte'
export {default as Bar} from './components/Bar.svelte'
export {default as BarChart} from './components/BarChart.svelte'
export {default as BigValue} from './components/BigValue.svelte'
export {default as Chart} from './components/Chart.svelte'
export {default as Column} from './components/Column.svelte'
export {default as DateRange} from './components/DateRange.svelte'
export {default as Dropdown} from './components/Dropdown.svelte'
export {default as DropdownOption} from './components/DropdownOption.svelte'
export {default as ECharts} from './components/ECharts.svelte'
export {default as ErrorChart} from './components/ErrorChart.svelte'
export {default as GrapheneQuery} from './components/GrapheneQuery.svelte'
export {default as InlineDelta} from './components/InlineDelta.svelte'
export {default as Line} from './components/Line.svelte'
export {default as LineChart} from './components/LineChart.svelte'
export {default as PieChart} from './components/PieChart.svelte'
export {default as QueryLoad} from './components/QueryLoad.svelte'
export {default as Row} from './components/Row.svelte'
export {default as SortIcon} from './components/SortIcon.svelte'
export {default as Table} from './components/Table.svelte'
export {default as TableCell} from './components/TableCell.svelte'
export {default as TableGroupRow} from './components/TableGroupRow.svelte'
export {default as TableGroupToggle} from './components/TableGroupToggle.svelte'
export {default as TableHeader} from './components/TableHeader.svelte'
export {default as TableRow} from './components/TableRow.svelte'
export {default as TableSubtotalRow} from './components/TableSubtotalRow.svelte'
export {default as TableTotalRow} from './components/TableTotalRow.svelte'
export {default as TextInput} from './components/TextInput.svelte'

let socket = null
let errors = []

window.addEventListener('error', (event) => errors.push(event.error))
window.addEventListener('unhandledrejection', (event) => errors.push(event.reason))
connectWebSocket()

async function takeScreenshot (chartName = null) {
  if (!window.html2canvas) {
    let html2canvas = await import('html2canvas')
    window.html2canvas = html2canvas.default
  }

  // wait some time for queries to finish loading
  let startTime = Date.now()
  while (isLoading() && Date.now() - startTime < 20_000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  let targetElement = chartName ? document.querySelector(`[name="${chartName}"]`) : document.body
  let canvas = targetElement && await window.html2canvas(targetElement, {useCORS: true, allowTaint: true, scale: 1})
  return {stillLoading: isLoading(), screenshot: canvas?.toDataURL('image/png')}
}

function connectWebSocket () {
  socket = new WebSocket(`ws://${window.location.host}/graphene-ws`)
  socket.onclose = () => setTimeout(connectWebSocket, 2000)

  socket.onopen = () => {
    socket.send(JSON.stringify({type: 'register', url: window.location.href}))
  }

  socket.onmessage = async (event) => {
    console.log('Got message', event.data)
    let {type, requestId, chart} = JSON.parse(event.data)

    if (type === 'view') {
      let {screenshot, stillLoading} = await takeScreenshot(chart)
      let serialErrs = errors.map(e => ({message: e.message, cause: e.cause}))
      socket.send(JSON.stringify({type: 'viewResponse', requestId, screenshot, stillLoading, errors: serialErrs}))
    }
  }
}
