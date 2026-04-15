import './internal/telemetry.ts'
import './internal/queryEngine.ts'
import './internal/runSocket.ts'
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
import ErrorChart from './internal/ErrorDisplay.svelte'
import LocalApp from './internal/LocalApp.svelte'

// Having a global $GRAPHENE allows us to provide an api that pages can use without having to import and bundle a bunch of components.
// That means that as you navigate around, we only have to a very small amount of js for the page itself, and the bulk of the container and component
// code only has to load once.
// In theory we could do this with Vite splitting, but then we have a hard dependency on the exact format vite uses. Plus I find the easier to understand.
window.$GRAPHENE = window.$GRAPHENE || {}

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
    if (!g.isQueryLoading() && pendingRenders.size == 0) {
      if (document.fonts?.ready) await document.fonts.ready
      await new Promise(resolve => setTimeout(resolve, 300))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (!g.isQueryLoading() && pendingRenders.size == 0) return true
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

window.$GRAPHENE.svelte = {mount, unmount}

mount(LocalApp, {target: document.body})
