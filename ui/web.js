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

async function captureChart (chartTitle) {
  await waitForQueriesToFinish()
  let errors = getErrors()
  let escaped = window.CSS.escape(chartTitle)
  let canvas = document.querySelector(`[data-chart-title="${escaped}"] canvas`)

  if (!canvas) {
    errors.push({message: `Could not find chart titled "${chartTitle}"`})
    return {stillLoading: isLoading(), screenshot: null, errors}
  }

  return {stillLoading: isLoading(), screenshot: canvas.toDataURL('image/png'), errors}
}

async function takeScreenshot () {
  await waitForQueriesToFinish()
  if (!window.html2canvas) {
    let html2canvas = await import('html2canvas')
    window.html2canvas = html2canvas.default
  }
  let canvas = await window.html2canvas(document.body, {useCORS: true, allowTaint: true, scale: 1})
  let errors = getErrors().map(e => ({message: e.message, id: e.id}))
  return {stillLoading: isLoading(), screenshot: canvas?.toDataURL('image/png'), errors}
}

async function waitForQueriesToFinish () {
  let startTime = Date.now()
  while (isLoading() && Date.now() - startTime < 20_000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

function connectWebSocket () {
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connectWebSocket, 2000)

  socket.onopen = () => {
    socket.send(JSON.stringify({type: 'register', url: window.location.href}))
  }

  socket.onmessage = async (event) => {
    let {type, requestId, chart} = JSON.parse(event.data)

    if (type === 'check') {
      let result = chart ? await captureChart(chart) : await takeScreenshot()
      socket.send(JSON.stringify({type: 'checkResponse', requestId, ...result}))
    }
  }
}
