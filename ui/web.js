import './internal/telemetry.ts'
import './internal/queryEngine.ts'
import './internal/runPage.ts'
import {getInstanceByDom} from 'echarts'
import {mount, unmount} from 'svelte'

import './app.css'
import AreaChart from './components/AreaChart.svelte'
import BarChart from './components/BarChart.svelte'
import BigValue from './components/BigValue.svelte'
import Column from './components/Column.svelte'
import DateRange from './components/DateRange.svelte'
import Dropdown from './components/Dropdown.svelte'
import DropdownOption from './components/DropdownOption.svelte'
import ECharts from './components/ECharts.svelte'
import GrapheneQuery from './components/GrapheneQuery.svelte'
import Hidden from './components/Hidden.svelte'
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
import Tooltip from './components/Tooltip.svelte'
import Value from './components/Value.svelte'
import ErrorChart from './internal/ErrorDisplay.svelte'
import LocalApp from './internal/LocalApp.svelte'
import './internal/waitForLoad.ts'

// Having a global $GRAPHENE allows us to provide an api that pages can use without having to import and bundle a bunch of components.
// That means that as you navigate around, we only have to a very small amount of js for the page itself, and the bulk of the container and component
// code only has to load once.
// In theory we could do this with Vite splitting, but then we have a hard dependency on the exact format vite uses. Plus I find the easier to understand.
window.$GRAPHENE = window.$GRAPHENE || {}
window.$GRAPHENE.appLoading = false

window.$GRAPHENE.getChart = domNode => {
  return getInstanceByDom(domNode)
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
  Hidden,
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
  Tooltip,
  Value,
}

window.$GRAPHENE.svelte = {mount, unmount}

if (window.location.pathname.replace(/\/+$/, '') !== '/__ct') {
  window.$GRAPHENE.appLoading = true
  mount(LocalApp, {target: document.body})
}
