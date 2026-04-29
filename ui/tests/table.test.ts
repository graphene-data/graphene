import {expect, test, waitForGrapheneLoad} from './fixtures.ts'
import {groupedDataForSection, tableDataForPagination, tableDataWithDates, timeseriesGrouped} from './testData.ts'

test.beforeEach(async ({sharedPage}) => {
  await sharedPage.setViewportSize({width: 1280, height: 720})
})

test('renders table data', async ({mount}) => {
  let t = await mount('components/Table.svelte', {data: timeseriesGrouped(), title: 'Sales'})
  await t.locator('tr:has(td)').first().waitFor()
  await expect(t).screenshot('table-renders-data')
})

test('table renders error state for missing sort column', async ({mount}) => {
  let component = await mount('components/Table.svelte', {data: tableDataWithDates(), sort: 'missing_col asc'})
  await expect(component).screenshot('missing-column')
})

test('sorts by column header', async ({mount}) => {
  let component = await mount('components/Table.svelte', {data: tableDataWithDates()})
  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()
  await expect(table.locator('tr:has(td)')).toHaveCount(3)

  let readFirstColumn = () => table.locator('tr:has(td) td:first-child').allTextContents()

  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])
  await expect(component.locator('.table-container')).screenshot('sort-default')

  let header = table.getByRole('columnheader').first()
  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-01-01', '2021-02-01', '2021-03-01'])
  await expect(component.locator('.table-container')).screenshot('sort-ascending')

  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-02-01', '2021-01-01'])
  await expect(component.locator('.table-container')).screenshot('sort-descending')
})

test('sortable=false keeps header clicks from changing order', async ({mount}) => {
  let component = await mount('components/Table.svelte', {data: tableDataWithDates(), sortable: false})
  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()

  let readFirstColumn = () => table.locator('tr:has(td) td:first-child').allTextContents()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])

  let header = table.getByRole('columnheader').first()
  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])
  await expect(component.locator('.table-container')).screenshot('sort-disabled')
})

test('paginates rows', async ({mount}) => {
  let component = await mount('components/Table.svelte', {data: tableDataForPagination(12), rows: 5})
  let table = component.locator('table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr:has(td)')).toHaveCount(5)

  let firstCell = () => table.locator('tr:has(td) td:first-child').first()

  await expect(firstCell()).toHaveText('Row 1')
  await expect(component.getByRole('button', {name: 'First'})).toBeDisabled()
  await expect(component.getByRole('button', {name: 'Prev'})).toBeDisabled()
  await component.getByRole('button', {name: 'Next'}).click()
  await expect(firstCell()).toHaveText('Row 6')
  await component.getByRole('button', {name: 'Last'}).click()
  await expect(firstCell()).toHaveText('Row 11')
  await expect(component.getByRole('button', {name: 'Last'})).toBeDisabled()
  await expect(component.getByRole('button', {name: 'Next'})).toBeDisabled()
  await component.getByRole('button', {name: 'First'}).click()
  await expect(firstCell()).toHaveText('Row 1')
  await expect(component.getByRole('button', {name: 'Prev'})).toBeDisabled()
  await expect(component.getByText('Page 1 of 3')).toBeVisible()
  await expect(component.locator('.pagination__meta')).toHaveText('5 of 12 rows')
  await expect(component.locator('.table-container')).screenshot('pagination-first-last')
})

test('colorscale with colorBreakpoints applies correct background colors', async ({mount}) => {
  let rows = [
    {carrier: 'WN', high_val: 0.886, mid_val: 0.178, low_val: 0.044},
    {carrier: 'US', high_val: 0.377, mid_val: 0.075, low_val: 0.019},
    {carrier: 'AA', high_val: 0.346, mid_val: 0.069, low_val: 0.017},
    {carrier: 'NW', high_val: 0.336, mid_val: 0.067, low_val: 0.017},
    {carrier: 'UA', high_val: 0.328, mid_val: 0.066, low_val: 0.016},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'high_val', type: 'number', metadata: {ratio: true}},
    {name: 'mid_val', type: 'number', metadata: {ratio: true}},
    {name: 'low_val', type: 'number', metadata: {ratio: true}},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {rows: 'all'},
    columns: [
      {id: 'carrier', title: 'Carrier'},
      {id: 'high_val', title: 'High', contentType: 'colorscale', colorScale: 'red, yellow, green', colorBreakpoints: '0, 0.5, 1'},
      {id: 'mid_val', title: 'Mid', contentType: 'colorscale', colorScale: 'red, yellow, green', colorBreakpoints: '0, 0.5, 1'},
      {id: 'low_val', title: 'Low', contentType: 'colorscale', colorScale: 'red, yellow, green', colorBreakpoints: '0, 0.5, 1'},
    ],
  })

  await component.locator('table tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('colorscale-breakpoints')
})

test('single-color colorscale renders as a heatmap from the page background', async ({mount}) => {
  let rows = [
    {carrier: 'WN', score: 0.95},
    {carrier: 'AA', score: 0.72},
    {carrier: 'UA', score: 0.48},
    {carrier: 'AS', score: 0.24},
    {carrier: 'B6', score: 0.05},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'score', type: 'number', metadata: {ratio: true}},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {rows: 'all'},
    columns: [
      {id: 'carrier', title: 'Carrier'},
      {id: 'score', title: 'Score', contentType: 'colorscale', colorScale: '#3D6B7E'},
    ],
  })

  await component.locator('table tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('colorscale-single-color-heatmap')
})

test('colorBreakpoints work when all column values are identical', async ({mount}) => {
  let rows = [
    {carrier: 'AA', val: 1},
    {carrier: 'AS', val: 1},
    {carrier: 'B6', val: 1},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'val', type: 'number', metadata: {ratio: true}},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {rows: 'all'},
    columns: [
      {id: 'carrier', title: 'Carrier'},
      {id: 'val', title: 'Value', contentType: 'colorscale', colorScale: 'red, yellow, green', colorBreakpoints: '0, 0.5, 1'},
    ],
  })

  await component.locator('table tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('colorscale-breakpoints-uniform')
})

test('groupType=section renders correct rowSpan for first row of each group', async ({mount}) => {
  let component = await mount('components/Table.svelte', {data: groupedDataForSection(), groupBy: 'time_horizon', groupType: 'section'})
  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()

  let cell30days = table.locator('td', {hasText: '30 days'}).first()
  await expect(cell30days).toHaveAttribute('rowspan', '3')

  let cell60days = table.locator('td', {hasText: '60 days'}).first()
  await expect(cell60days).toHaveAttribute('rowspan', '2')

  let cell90days = table.locator('td', {hasText: '90 days'}).first()
  await expect(cell90days).toHaveAttribute('rowspan', '1')
  await expect(component.locator('.table-container')).screenshot('group-section-rowspan')
})

test('row numbers stay stable across sort and pagination states', async ({mount, sharedPage}) => {
  let component = await mount('components/Table.svelte', {
    data: tableDataForPagination(12),
    rows: 5,
    rowNumbers: true,
    sort: 'value desc',
  })
  await waitForGrapheneLoad(sharedPage)

  let table = component.locator('table')
  await expect(table).toBeVisible()
  let firstRow = table.locator('tr.table-row').first()
  await expect(firstRow.locator('td.index')).toHaveText('1')
  await expect(firstRow.locator('td').last()).toHaveText('12')
  await expect(component.locator('.table-container')).screenshot('row-numbers-sort-page-1')

  await table.getByRole('columnheader', {name: 'Value'}).click()
  await expect(table.locator('tr.table-row').first().locator('td').last()).toHaveText('1')
  await expect(component.locator('.table-container')).screenshot('row-numbers-sort-asc-page-1')

  await component.getByRole('button', {name: 'Next'}).click()
  firstRow = table.locator('tr.table-row').first()
  await expect(firstRow.locator('td.index')).toHaveText('6')
  await expect(firstRow.locator('td').last()).toHaveText('6')
  await expect(component.locator('.table-container')).screenshot('row-numbers-sort-asc-page-2')
})

test('accordion grouping with subtotals renders and collapses predictably', async ({mount}) => {
  let component = await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'accordion',
    subtotals: true,
    rowNumbers: true,
  })

  let table = component.locator('table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr.group-row')).toHaveCount(3)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(3)
  await expect(table.locator('tr.subtotal-row').first().locator('td')).toHaveCount(4)

  await table.locator('tr.group-row').first().click()
  await expect(table.locator('tr.table-row')).toHaveCount(3)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(2)

  await table.locator('tr.group-row').first().click()
  await expect(table.locator('tr.table-row')).toHaveCount(6)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(3)
  await expect(component.locator('.table-container')).screenshot('group-accordion-subtotals-open')

  component = await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'accordion',
    subtotals: true,
    rowNumbers: true,
    groupsOpen: false,
  })
  table = component.locator('table')
  await expect(table.locator('tr.group-row')).toHaveCount(3)
  await expect(table.locator('tr.table-row')).toHaveCount(0)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(0)
  await expect(component.locator('.table-container')).screenshot('group-accordion-subtotals-collapsed')
})

test('table attributes render grouped headers, wrapped titles, and row styling options', async ({mount}) => {
  let rows = [
    {carrier: 'AA', flights: 34580, avg_delay: 7.395, max_delay: 1160},
    {carrier: 'AS', flights: 8450, avg_delay: 12.271, max_delay: 694},
    {carrier: 'B6', flights: 4840, avg_delay: 7.502, max_delay: 654},
    {carrier: 'CO', flights: 7140, avg_delay: 6.013, max_delay: 716},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'flights', type: 'number'},
    {name: 'avg_delay', type: 'number'},
    {name: 'max_delay', type: 'number'},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {
      rows: 'all',
      title: 'Carrier delay profile',
      subtitle: 'Grouped headers, wrapped titles, and compact rows',
      rowShading: true,
      rowLines: false,
      wrapTitles: true,
      compact: true,
      headerColor: '#d9f0ff',
      headerFontColor: '#0f172a',
      backgroundColor: '#f8fafc',
    },
    columns: [
      {id: 'carrier', title: 'Carrier', description: 'Carrier code', colGroup: 'Meta'},
      {id: 'flights', title: 'Total Flights', colGroup: 'Metrics', align: 'right'},
      {id: 'avg_delay', title: 'Average Delay Minutes Across All Flight Records', colGroup: 'Metrics', wrapTitle: true},
      {id: 'max_delay', title: 'Peak Delay', colGroup: 'Metrics'},
    ],
  })

  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()
  await expect(table.locator('tr:has(td)')).toHaveCount(4)
  await expect(component.locator('.table-container')).screenshot('attribute-groups-and-styling')
})

test('headers align with their cells with and without wrapped titles', async ({mount}) => {
  let rows = [
    {carrier: 'AA', flights: 34580, avg_delay: 7.395, refund_rate: 0.128},
    {carrier: 'AS', flights: 8450, avg_delay: 12.271, refund_rate: 0.094},
    {carrier: 'B6', flights: 4840, avg_delay: 7.502, refund_rate: 0.173},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'flights', type: 'number'},
    {name: 'avg_delay', type: 'number'},
    {name: 'refund_rate', type: 'number', metadata: {ratio: true}},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    width: 620,
    tableProps: {rows: 'all', title: 'Header alignment', sort: 'avg_delay asc'},
    columns: [
      {id: 'carrier', title: 'Carrier Code With A Wrapped Left Aligned Header', wrapTitle: true},
      {id: 'flights', title: 'Total Flights'},
      {id: 'avg_delay', title: 'Average Delay Minutes Across All Flight Records In The Dataset For Current Period', wrapTitle: true},
      {id: 'refund_rate', title: 'Refund Rate', align: 'center'},
    ],
  })

  await component.locator('table tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('headers-align-with-cells')
})

test('section groups respect groupNamePosition and subtotal styles', async ({mount}) => {
  let component = await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'section',
    groupNamePosition: 'top',
    subtotals: true,
    subtotalRowColor: '#ecfeff',
    subtotalFontColor: '#0c4a6e',
  })

  let table = component.locator('table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr.subtotal-row')).toHaveCount(3)
  await expect(component.locator('.table-container')).screenshot('section-group-position-top')
})

test('total row renders for ungrouped tables', async ({mount, sharedPage}) => {
  let component = await mount('components/Table.svelte', {
    data: tableDataForPagination(4),
    rowNumbers: true,
    totalRow: true,
    rows: 'all',
  })

  await waitForGrapheneLoad(sharedPage)

  let table = component.locator('table')
  let totalRow = table.locator('tr.total-row')
  await expect(totalRow).toBeVisible()
  await expect(totalRow).toContainText('10')
  await expect(component.locator('.table-container')).screenshot('total-row-basic')
})

test('row-level link behavior opens external destinations and hides link column', async ({mount, sharedPage}) => {
  let rows = [
    {name: 'Alpha', value: 12, url: 'https://example.com/alpha'},
    {name: 'Beta', value: 8, url: null},
    {name: 'Gamma', value: 5, url: 'https://example.com/gamma'},
  ] as any
  let fields = [
    {name: 'name', type: 'string'},
    {name: 'value', type: 'number'},
    {name: 'url', type: 'string'},
  ] as any

  let component = await mount('components/Table.svelte', {data: {rows, fields}, link: 'url', rowNumbers: true, rows: 'all'})

  let table = component.locator('table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', {name: 'Url'})).toHaveCount(0)

  let noPopupPromise = sharedPage
    .waitForEvent('popup', {timeout: 500})
    .then(() => true)
    .catch(() => false)
  await table.locator('tr.table-row').nth(1).click()
  expect(await noPopupPromise).toBe(false)

  await expect(component.locator('.table-container')).screenshot('row-link-hidden-column')

  let popupPromise = sharedPage.waitForEvent('popup')
  await table.locator('tr.table-row').first().click()
  let popup = await popupPromise
  await expect.poll(() => popup.url()).toContain('https://example.com/alpha')
  await popup.close()
})

test('colorscale and link content columns render together', async ({mount, sharedPage}) => {
  let rows = [
    {carrier: 'AA', retention: 1.153, details_url: 'https://example.com'},
    {carrier: 'AS', retention: 0.282, details_url: 'https://example.com'},
    {carrier: 'B6', retention: 0.161, details_url: 'https://example.com'},
    {carrier: 'CO', retention: 0.238, details_url: 'https://example.com'},
    {carrier: 'DL', retention: 1.071, details_url: 'https://example.com'},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'retention', type: 'number', metadata: {ratio: true}},
    {name: 'details_url', type: 'string'},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {rows: 'all'},
    columns: [
      {id: 'carrier', title: 'Carrier'},
      {id: 'retention', title: 'Retention', contentType: 'colorscale', colorScale: 'red, yellow, green', colorBreakpoints: '0, 0.5, 1'},
      {id: 'details_url', title: 'Details', contentType: 'link', linkLabel: 'Open', openInNewTab: true},
    ],
  })

  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('colorscale-with-link-content')

  let popupPromise = sharedPage.waitForEvent('popup')
  await table.locator('a.table-link').first().click()
  let popup = await popupPromise
  await expect.poll(() => popup.url()).toContain('https://example.com')
  await popup.close()
})

test('image and link content columns honor sizing, labels, and tab target attributes', async ({mount}) => {
  let logo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2234%22 height=%2218%22%3E%3Crect width=%2234%22 height=%2218%22 fill=%22%230ea5e9%22/%3E%3C/svg%3E'
  let rows = [
    {carrier: 'AA', logo, profile_url: 'https://example.com/carriers/aa'},
    {carrier: 'AS', logo, profile_url: 'https://example.com/carriers/as'},
    {carrier: 'B6', logo, profile_url: 'https://example.com/carriers/b6'},
  ]
  let fields = [
    {name: 'carrier', type: 'string'},
    {name: 'logo', type: 'string'},
    {name: 'profile_url', type: 'string'},
  ]

  let component = await mount('components/TableHarness.svelte', {
    data: {rows, fields},
    tableProps: {rows: 'all'},
    columns: [
      {id: 'carrier', title: 'Carrier'},
      {id: 'logo', title: 'Logo', contentType: 'image', alt: 'carrier', width: '34px', height: '18px'},
      {id: 'profile_url', title: 'Profile', contentType: 'link', linkLabel: 'carrier', openInNewTab: false},
    ],
  })

  let table = component.locator('table')
  await table.locator('tr:has(td)').first().waitFor()
  await expect(component.locator('.table-container')).screenshot('content-image-and-link')
})
