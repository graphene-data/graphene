import {getErrors} from './internal/telemetry.ts'
import './app.css'
import {isLoading} from './internal/queryEngine.ts'

import Area from './components/Area.svelte'
import AreaChart from './components/AreaChart.svelte'
import Bar from './components/Bar.svelte'
import BarChart from './components/BarChart.svelte'
import BigValue from './components/BigValue.svelte'
import Chart from './components/Chart.svelte'
import Column from './components/Column.svelte'
import DateRange from './components/DateRange.svelte'
import Dropdown from './components/Dropdown.svelte'
import DropdownOption from './components/DropdownOption.svelte'
import ECharts from './components/ECharts.svelte'
import ErrorChart from './components/ErrorChart.svelte'
import GrapheneQuery from './components/GrapheneQuery.svelte'
import InlineDelta from './components/InlineDelta.svelte'
import Line from './components/Line.svelte'
import LineChart from './components/LineChart.svelte'
import PieChart from './components/PieChart.svelte'
import QueryLoad from './components/QueryLoad.svelte'
import Row from './components/Row.svelte'
import SortIcon from './components/SortIcon.svelte'
import Table from './components/Table.svelte'
import TableCell from './components/TableCell.svelte'
import TableGroupRow from './components/TableGroupRow.svelte'
import TableGroupToggle from './components/TableGroupToggle.svelte'
import TableHeader from './components/TableHeader.svelte'
import TableRow from './components/TableRow.svelte'
import TableSubtotalRow from './components/TableSubtotalRow.svelte'
import TableTotalRow from './components/TableTotalRow.svelte'
import TextInput from './components/TextInput.svelte'

window.$GRAPHENE.components = {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BigValue,
  Chart,
  Column,
  DateRange,
  Dropdown,
  DropdownOption,
  ECharts,
  ErrorChart,
  GrapheneQuery,
  InlineDelta,
  Line,
  LineChart,
  PieChart,
  QueryLoad,
  Row,
  SortIcon,
  Table,
  TableCell,
  TableGroupRow,
  TableGroupToggle,
  TableHeader,
  TableRow,
  TableSubtotalRow,
  TableTotalRow,
  TextInput,
}


let socket = null

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
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connectWebSocket, 2000)

  socket.onopen = () => {
    socket.send(JSON.stringify({type: 'register', url: window.location.href}))
  }

  socket.onmessage = async (event) => {
    console.log('Got message', event.data)
    let {type, requestId, chart} = JSON.parse(event.data)

    if (type === 'view') {
      let {screenshot, stillLoading} = await takeScreenshot(chart)
      socket.send(JSON.stringify({type: 'viewResponse', requestId, screenshot, stillLoading, errors: getErrors()}))
    }
  }
}
