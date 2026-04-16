import {type Field} from '../component-utilities/types.ts'

type TableRows = {rows: any[]; fields: Field[]}

export function singleDim(): TableRows {
  let result: Record<string, number> = {}
  ordersByCategory.forEach(row => {
    result[row.category] = (result[row.category] || 0) + row.sales_usd0k
  })

  let rows = Object.keys(result).map(category => ({category, value: result[category]}))
  let fields: Field[] = [
    {name: 'category', type: 'string'},
    {name: 'value', type: 'number', metadata: {units: 'usd'}},
  ]
  return withFields(rows, fields)
}

export function timeseries(): TableRows {
  let result: Record<string, number> = {}
  ordersByCategory.forEach(row => {
    result[row.month] = (result[row.month] || 0) + row.sales_usd0k
  })

  let rows = Object.keys(result).map(month => ({month: new Date(month), sales_usd0k: result[month]}))
  let fields: Field[] = [
    {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
    {name: 'sales_usd0k', type: 'number', metadata: {units: 'usd'}},
  ]
  return withFields(rows, fields)
}

export function timeseriesGrouped(): TableRows {
  let rows = ordersByCategory.map(row => ({...row, month: new Date(row.month)}))
  let fields: Field[] = [
    {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
    {name: 'category', type: 'string'},
    {name: 'sales_usd0k', type: 'number', metadata: {units: 'usd'}},
  ]
  return withFields(rows, fields)
}

export function sparseGroupedMonthRows(): TableRows {
  let rows = [
    {month: '2024-06-01', metric: 'A', value: 60},
    {month: '2024-03-01', metric: 'A', value: 30},
    {month: '2024-01-01', metric: 'A', value: 10},
    {month: '2024-05-01', metric: 'A', value: 50},
    {month: '2024-02-01', metric: 'A', value: 20},
    {month: '2024-04-01', metric: 'A', value: 40},
    {month: '2024-01-01', metric: 'B', value: 15},
    {month: '2024-03-01', metric: 'B', value: 25},
    {month: '2024-06-01', metric: 'B', value: 35},
    {month: '2024-02-01', metric: 'B', value: 18},
    {month: '2024-05-01', metric: 'B', value: 28},
    // April for metric B is intentionally missing.
  ]
  let fields: Field[] = [
    {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
    {name: 'metric', type: 'string'},
    {name: 'value', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

export function timeseriesWithDateSeries(): TableRows {
  let rows = [
    {quarter: '2021-01-01', category: 'Widgets', sales: 100},
    {quarter: '2021-01-01', category: 'Gadgets', sales: 200},
    {quarter: '2021-04-01', category: 'Widgets', sales: 150},
    {quarter: '2021-04-01', category: 'Gadgets', sales: 250},
    {quarter: '2021-07-01', category: 'Widgets', sales: 175},
    {quarter: '2021-07-01', category: 'Gadgets', sales: 300},
  ]
  let fields: Field[] = [
    {name: 'quarter', type: 'date', metadata: {timeGrain: 'quarter'}},
    {name: 'category', type: 'string'},
    {name: 'sales', type: 'number', metadata: {units: 'usd'}},
  ]
  return withFields(rows, fields)
}

export function yearlyCounts(): TableRows {
  let rows = [
    {year: 2000, flights: 90},
    {year: 2001, flights: 80},
    {year: 2002, flights: 75},
    {year: 2003, flights: 95},
    {year: 2004, flights: 110},
    {year: 2005, flights: 120},
  ]
  let fields: Field[] = [
    {name: 'year', type: 'number', metadata: {timeGrain: 'year'}},
    {name: 'flights', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

export function denseTimeseries(points = 365): TableRows {
  let start = Date.UTC(2024, 0, 1)
  let rows = Array.from({length: points}, (_, index) => {
    let trend = Math.sin(index / 12) * 25
    let seasonality = Math.cos(index / 3) * 6
    return {
      ts: new Date(start + index * 24 * 60 * 60 * 1000),
      value: 120 + trend + seasonality,
    }
  })

  let fields: Field[] = [
    {name: 'ts', type: 'date', metadata: {timeGrain: 'day'}},
    {name: 'value', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

export function categoricalSeries(count: number): TableRows {
  let rows = Array.from({length: count}, (_, index) => ({category: `Bucket ${index + 1}`, value: 100 + Math.sin(index / 2) * 20}))
  let fields: Field[] = [
    {name: 'category', type: 'string'},
    {name: 'value', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

export function ratioTimeseries(): TableRows {
  let rows = [
    {month: '2024-01-01', conversion_rate: 0.124},
    {month: '2024-02-01', conversion_rate: 0.158},
    {month: '2024-03-01', conversion_rate: 0.137},
  ]
  let fields: Field[] = [
    {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
    {name: 'conversion_rate', type: 'number', metadata: {ratio: true}},
  ]
  return withFields(rows, fields)
}

export function tableDataWithDates(): TableRows {
  let rows = [
    {month: '2021-03-01', sales: 50},
    {month: '2021-01-01', sales: 75},
    {month: '2021-02-01', sales: 65},
  ]
  let fields: Field[] = [
    {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
    {name: 'sales', type: 'number', metadata: {units: 'usd'}},
  ]
  return withFields(rows, fields)
}

export function tableDataForPagination(count = 15): TableRows {
  let rows = Array.from({length: count}, (_, index) => ({
    item: `Row ${index + 1}`,
    value: index + 1,
  }))
  let fields: Field[] = [
    {name: 'item', type: 'string'},
    {name: 'value', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

export function groupedDataForSection(): TableRows {
  let rows = [
    {time_horizon: '30 days', sku: 'SKU-A', units: 100},
    {time_horizon: '30 days', sku: 'SKU-B', units: 80},
    {time_horizon: '30 days', sku: 'SKU-C', units: 60},
    {time_horizon: '60 days', sku: 'SKU-A', units: 150},
    {time_horizon: '60 days', sku: 'SKU-B', units: 120},
    {time_horizon: '90 days', sku: 'SKU-A', units: 200},
  ]
  let fields: Field[] = [
    {name: 'time_horizon', type: 'string'},
    {name: 'sku', type: 'string'},
    {name: 'units', type: 'number', metadata: {units: 'count'}},
  ]
  return withFields(rows, fields)
}

function withFields(rows: any[], fields: Field[]): TableRows {
  return {rows, fields}
}

let ordersByCategory = [
  {
    month: '2021-01-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 43966.05,
  },
  {
    month: '2021-01-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 36969.84999999999,
  },
  {
    month: '2021-01-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15621.250000000011,
  },
  {
    month: '2021-01-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6199.950000000007,
  },
  {
    month: '2021-02-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 45583.150000000045,
  },
  {
    month: '2021-02-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 34719.149999999994,
  },
  {
    month: '2021-02-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 12399.550000000012,
  },
  {
    month: '2021-02-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 5392.349999999996,
  },
  {
    month: '2021-03-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 51840.55000000002,
  },
  {
    month: '2021-03-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 38836.749999999985,
  },
  {
    month: '2021-03-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15058.850000000011,
  },
  {
    month: '2021-03-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6698.950000000004,
  },
  {
    month: '2021-04-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 47765.450000000004,
  },
  {
    month: '2021-04-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 39009.600000000006,
  },
  {
    month: '2021-04-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15934.20000000002,
  },
  {
    month: '2021-04-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6343.550000000006,
  },
  {
    month: '2021-05-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 52668.300000000054,
  },
  {
    month: '2021-05-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 41495.750000000015,
  },
  {
    month: '2021-05-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15328.750000000011,
  },
  {
    month: '2021-05-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6291.150000000006,
  },
  {
    month: '2021-06-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 49689.20000000001,
  },
  {
    month: '2021-06-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 40832.15,
  },
  {
    month: '2021-06-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 14916.650000000023,
  },
  {
    month: '2021-06-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 5980.700000000006,
  },
  {
    month: '2021-07-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 51344.70000000007,
  },
  {
    month: '2021-07-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 40620.5,
  },
  {
    month: '2021-07-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15436.900000000007,
  },
  {
    month: '2021-07-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 7379.300000000007,
  },
  {
    month: '2021-08-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 55690.15000000004,
  },
  {
    month: '2021-08-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 43625.25000000001,
  },
  {
    month: '2021-08-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 16500.200000000015,
  },
  {
    month: '2021-08-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6643.750000000001,
  },
  {
    month: '2021-09-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 49578.15,
  },
  {
    month: '2021-09-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 42763.299999999996,
  },
  {
    month: '2021-09-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 14660.250000000013,
  },
  {
    month: '2021-09-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6788.800000000004,
  },
  {
    month: '2021-10-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 53822.90000000002,
  },
  {
    month: '2021-10-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 45728.600000000006,
  },
  {
    month: '2021-10-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 16961.75000000001,
  },
  {
    month: '2021-10-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 6956.4000000000015,
  },
  {
    month: '2021-11-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 53398.150000000016,
  },
  {
    month: '2021-11-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 45462.09999999999,
  },
  {
    month: '2021-11-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 15786.350000000013,
  },
  {
    month: '2021-11-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 7108.2000000000035,
  },
  {
    month: '2021-12-01T00:00:00.000Z',
    category: 'Odd Equipment',
    sales_usd0k: 55766.10000000002,
  },
  {
    month: '2021-12-01T00:00:00.000Z',
    category: 'Cursed Sporting Goods',
    sales_usd0k: 43591.35,
  },
  {
    month: '2021-12-01T00:00:00.000Z',
    category: 'Mysterious Apparel',
    sales_usd0k: 16110.95000000001,
  },
  {
    month: '2021-12-01T00:00:00.000Z',
    category: 'Sinister Toys',
    sales_usd0k: 7010.800000000008,
  },
]
