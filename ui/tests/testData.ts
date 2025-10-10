import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

let dataFile = path.resolve(fileURLToPath(import.meta.url), '../ordersByCategory.json')
let ordersByCategory = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))

type TableRows = {rows: any}

export function singleDim (): TableRows {
  let result: Record<string, number> = {}
  ordersByCategory.forEach((row: any) => {
    result[row.category] = (result[row.category] || 0) + row.sales_usd0k
  })
  let rows = Object.keys(result).map((category) => ({category, value: result[category]})) as any
  rows._evidenceColumnTypes = [
    {name: 'category', evidenceType: 'string'},
    {name: 'sales_usd0k', evidenceType: 'number'},
  ]
  return {rows}
}

export function timeseries (): TableRows {
  let result: Record<string, number> = {}
  ordersByCategory.forEach((row: any) => {
    result[row.month] = (result[row.month] || 0) + row.sales_usd0k
  })
  let rows = Object.keys(result).map((month) => ({month: new Date(month), sales_usd0k: result[month]})) as any
  rows._evidenceColumnTypes = [
    {name: 'month', evidenceType: 'date'},
    {name: 'sales_usd0k', evidenceType: 'number'},
  ]
  return {rows}
}

export function timeseriesGrouped (): TableRows {
  let rows = ordersByCategory.map((row: any) => ({...row, month: new Date(row.month)})) as any
  rows._evidenceColumnTypes = [
    {name: 'month', evidenceType: 'date'},
    {name: 'category', evidenceType: 'string'},
    {name: 'sales_usd0k', evidenceType: 'number'},
  ]
  return {rows}
}

export function tableDataWithDates (): TableRows {
  let rows = [
    {month: '2021-03-01', sales: 50},
    {month: '2021-01-01', sales: 75},
    {month: '2021-02-01', sales: 65},
  ] as any
  rows._evidenceColumnTypes = [
    {name: 'month', evidenceType: 'date'},
    {name: 'sales', evidenceType: 'number'},
  ]
  return {rows}
}

export function tableDataForPagination (count = 15): TableRows {
  let rows = Array.from({length: count}, (_, index) => ({
    item: `Row ${index + 1}`,
    value: index + 1,
  })) as any
  rows._evidenceColumnTypes = [
    {name: 'item', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]
  return {rows}
}
