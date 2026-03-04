import './internal/telemetry.ts'
import './internal/queryEngine.ts'
import './internal/runSocket.ts'
import './app.css'
import {mount} from 'svelte'
import LocalApp from './internal/LocalApp.svelte'

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
import ErrorChart from './internal/ErrorDisplay.svelte'
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

window.$GRAPHENE = window.$GRAPHENE || {}

let nextRenderId = 0
let pendingRenders = new Set()

window.$GRAPHENE.renderStart = (id) => {
  let renderId = id == null ? `render:${++nextRenderId}` : String(id)
  pendingRenders.add(renderId)
  return renderId
}

window.$GRAPHENE.renderComplete = (id) => {
  if (id == null) return
  pendingRenders.delete(String(id))
}

window.$GRAPHENE.waitForLoad = async(timeout = 20_000) => {
  let g = window.$GRAPHENE
  let end = Date.now() + timeout
  while (Date.now() < end) {
    if (!g.isQueryLoading() && pendingRenders.size == 0) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

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

mount(LocalApp, {target: document.body})
