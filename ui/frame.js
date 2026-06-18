import './internal/telemetry.ts'
import './internal/queryEngine.ts'
import {getInstanceByDom} from 'echarts'

import './app.css'
import {mount, unmount} from 'svelte'

import AreaChart from './components/AreaChart.svelte'
import BarChart from './components/BarChart.svelte'
import BigValue from './components/BigValue.svelte'
import Column from './components/Column.svelte'
import DateRange from './components/DateRange.svelte'
import Dropdown from './components/Dropdown.svelte'
import DropdownOption from './components/DropdownOption.svelte'
import ECharts from './components/ECharts.svelte'
import GrapheneQuery from './components/GrapheneQuery.svelte'
import InlineDelta from './components/InlineDelta.svelte'
import LineChart from './components/LineChart.svelte'
import PieChart from './components/PieChart.svelte'
import QueryLoad from './components/QueryLoad.svelte'
import Row from './components/Row.svelte'
import ScatterPlot from './components/ScatterPlot.svelte'
import SortIcon from './components/SortIcon.svelte'
import Table from './components/Table.svelte'
import TableCell from './components/TableCell.svelte'
import TableGroupRow from './components/TableGroupRow.svelte'
import TableGroupToggle from './components/TableGroupToggle.svelte'
import TableHarness from './components/TableHarness.svelte'
import TableHeader from './components/TableHeader.svelte'
import TableRow from './components/TableRow.svelte'
import TableSubtotalRow from './components/TableSubtotalRow.svelte'
import TableTotalRow from './components/TableTotalRow.svelte'
import TextInput from './components/TextInput.svelte'
import Value from './components/Value.svelte'
import ErrorChart from './internal/ErrorDisplay.svelte'
import LocalFrame from './internal/LocalFrame.svelte'

window.$GRAPHENE = window.$GRAPHENE || {}
window.$GRAPHENE.appLoading = true
window.$GRAPHENE.disableClientCache = true

let nextRenderId = 0
let pendingRenders = new Set()

window.$GRAPHENE.getChart = domNode => {
  return getInstanceByDom(domNode)
}

window.$GRAPHENE.renderStart = id => {
  let renderId = id == null ? `render:${++nextRenderId}` : String(id)
  pendingRenders.add(renderId)
  return renderId
}

window.$GRAPHENE.renderComplete = id => {
  if (id == null) return
  pendingRenders.delete(String(id))
}

window.$GRAPHENE.waitForLoad = async (timeout = 20_000) => {
  let g = window.$GRAPHENE
  let end = Date.now() + timeout
  while (Date.now() < end) {
    if (!g.appLoading && !g.isQueryLoading() && pendingRenders.size == 0) {
      if (document.fonts?.ready) await document.fonts.ready
      await new Promise(resolve => setTimeout(resolve, 300))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (!g.appLoading && !g.isQueryLoading() && pendingRenders.size == 0) return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

window.$GRAPHENE.components = {
  AreaChart,
  BarChart,
  BigValue,
  Column,
  DateRange,
  Dropdown,
  DropdownOption,
  ECharts,
  ErrorChart,
  GrapheneQuery,
  InlineDelta,
  LineChart,
  PieChart,
  QueryLoad,
  Row,
  ScatterPlot,
  SortIcon,
  Table,
  TableCell,
  TableGroupRow,
  TableGroupToggle,
  TableHeader,
  TableHarness,
  TableRow,
  TableSubtotalRow,
  TableTotalRow,
  TextInput,
  Value,
}

window.$GRAPHENE.svelte = {mount, unmount}

mount(LocalFrame, {target: document.body})
