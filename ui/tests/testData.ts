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

let ordersByCategory = [
  {
    'month': '2021-01-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 43966.05,
  },
  {
    'month': '2021-01-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 36969.84999999999,
  },
  {
    'month': '2021-01-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15621.250000000011,
  },
  {
    'month': '2021-01-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6199.950000000007,
  },
  {
    'month': '2021-02-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 45583.150000000045,
  },
  {
    'month': '2021-02-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 34719.149999999994,
  },
  {
    'month': '2021-02-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 12399.550000000012,
  },
  {
    'month': '2021-02-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 5392.349999999996,
  },
  {
    'month': '2021-03-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 51840.55000000002,
  },
  {
    'month': '2021-03-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 38836.749999999985,
  },
  {
    'month': '2021-03-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15058.850000000011,
  },
  {
    'month': '2021-03-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6698.950000000004,
  },
  {
    'month': '2021-04-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 47765.450000000004,
  },
  {
    'month': '2021-04-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 39009.600000000006,
  },
  {
    'month': '2021-04-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15934.20000000002,
  },
  {
    'month': '2021-04-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6343.550000000006,
  },
  {
    'month': '2021-05-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 52668.300000000054,
  },
  {
    'month': '2021-05-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 41495.750000000015,
  },
  {
    'month': '2021-05-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15328.750000000011,
  },
  {
    'month': '2021-05-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6291.150000000006,
  },
  {
    'month': '2021-06-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 49689.20000000001,
  },
  {
    'month': '2021-06-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 40832.15,
  },
  {
    'month': '2021-06-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 14916.650000000023,
  },
  {
    'month': '2021-06-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 5980.700000000006,
  },
  {
    'month': '2021-07-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 51344.70000000007,
  },
  {
    'month': '2021-07-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 40620.5,
  },
  {
    'month': '2021-07-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15436.900000000007,
  },
  {
    'month': '2021-07-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 7379.300000000007,
  },
  {
    'month': '2021-08-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 55690.15000000004,
  },
  {
    'month': '2021-08-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 43625.25000000001,
  },
  {
    'month': '2021-08-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 16500.200000000015,
  },
  {
    'month': '2021-08-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6643.750000000001,
  },
  {
    'month': '2021-09-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 49578.15,
  },
  {
    'month': '2021-09-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 42763.299999999996,
  },
  {
    'month': '2021-09-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 14660.250000000013,
  },
  {
    'month': '2021-09-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6788.800000000004,
  },
  {
    'month': '2021-10-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 53822.90000000002,
  },
  {
    'month': '2021-10-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 45728.600000000006,
  },
  {
    'month': '2021-10-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 16961.75000000001,
  },
  {
    'month': '2021-10-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 6956.4000000000015,
  },
  {
    'month': '2021-11-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 53398.150000000016,
  },
  {
    'month': '2021-11-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 45462.09999999999,
  },
  {
    'month': '2021-11-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 15786.350000000013,
  },
  {
    'month': '2021-11-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 7108.2000000000035,
  },
  {
    'month': '2021-12-01T00:00:00.000Z',
    'category': 'Odd Equipment',
    'sales_usd0k': 55766.10000000002,
  },
  {
    'month': '2021-12-01T00:00:00.000Z',
    'category': 'Cursed Sporting Goods',
    'sales_usd0k': 43591.35,
  },
  {
    'month': '2021-12-01T00:00:00.000Z',
    'category': 'Mysterious Apparel',
    'sales_usd0k': 16110.95000000001,
  },
  {
    'month': '2021-12-01T00:00:00.000Z',
    'category': 'Sinister Toys',
    'sales_usd0k': 7010.800000000008,
  },
]
