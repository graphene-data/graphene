import {expect, test, waitForGrapheneLoad} from './fixtures.ts'

test.beforeEach(async ({page, sharedPage}) => {
  await page.setViewportSize({width: 900, height: 620})
  await sharedPage.setViewportSize({width: 900, height: 620})
})

async function loadDropdownPage(server: {mockFile: (path: string, content: string) => void; url: () => string}, page: any, componentMarkup: string) {
  server.mockFile(
    '/index.md',
    `
    # Input Playground

    \`\`\`sql dropdown_options
    from flights select carrier as code, carrier as label group by 1 order by 1
    \`\`\`

    ${componentMarkup}
  `,
  )
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
}

async function lockOpenDropdownWidth(page: any, width = 220) {
  await page.evaluate(lockedWidth => {
    let menu = document.querySelector('.dropdown-menu[role="listbox"]') as HTMLElement | null
    if (!menu) return
    let px = `${lockedWidth}px`
    menu.style.width = px
    menu.style.minWidth = px
  }, width)
}

async function startParamTracking(page: any) {
  await page.evaluate(() => {
    let w = window as any
    w.__paramUpdates = []
    let originalUpdateParam = w.$GRAPHENE.updateParam.bind(w.$GRAPHENE)
    w.$GRAPHENE.updateParam = (name: string, value: unknown) => {
      w.__paramUpdates.push({name, value})
      return originalUpdateParam(name, value)
    }
  })
}

function lastParamUpdate(page: any, name?: string): Promise<{name: string; value: unknown} | null> {
  return page.evaluate(paramName => {
    let updates = (window as any).__paramUpdates as Array<{name: string; value: unknown}> | undefined
    if (paramName) updates = updates?.filter(update => update.name === paramName)
    if (!updates?.length) return null
    return updates[updates.length - 1]
  }, name)
}

function allParamUpdates(page: any): Promise<Array<{name: string; value: unknown}>> {
  return page.evaluate(() => (window as any).__paramUpdates ?? [])
}

function readSearchParams(page: any): Promise<Record<string, string | string[]>> {
  return page.evaluate(() => {
    let values = {} as Record<string, string | string[]>
    for (let [name, value] of new URLSearchParams(window.location.search).entries()) {
      let existing = values[name]
      if (existing === undefined) values[name] = value
      else if (Array.isArray(existing)) existing.push(value)
      else values[name] = [existing, value]
    }
    return values
  })
}

test('returns missing query parameters as Graphene errors', async ({server, page}) => {
  let response = await page.request.post(server.url() + '/_api/query', {
    data: {gsql: 'from flights select carrier where carrier = $carrier limit 1', params: {}, hashes: []},
  })
  expect(response.status()).toBe(400)
  expect(await response.json()).toEqual({message: 'Missing param $carrier', severity: 'error'})
})

test('returns warehouse query rejection details', async ({server, page}) => {
  let response = await page.request.post(server.url() + '/_api/query', {
    data: {gsql: 'from flights select sqrt(dep_delay) as boom', params: {}, hashes: []},
  })
  let body = await response.json()
  expect({status: response.status(), message: body.message, hasStack: typeof body.stack == 'string'}).toEqual({
    status: 500,
    message: 'Out of Range Error: cannot take square root of a negative number',
    hasStack: true,
  })
})

test('query blocks can be defined after the component that uses them', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Query Registration Order

    <Dropdown name="carrier" data="dropdown_options" value="code" label="label" title="Carrier" />

    \`\`\`sql dropdown_options
    from flights select carrier as code, carrier as label group by 1 order by 1
    \`\`\`
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await page.getByRole('combobox', {name: 'Carrier'}).click()
  await expect(page.getByRole('option', {name: 'AA'})).toBeVisible()
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('query-block-after-component')
})

test('dropdown selection supports single and bulk interactions', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="carrier" data="dropdown_options" value="code" label="label" title="Carrier" />
    <Dropdown name="carrier_multi" data="dropdown_options" value="code" label="label" title="Carriers" multiple=true placeholder="Pick carriers" />
  `,
  )
  await startParamTracking(page)

  // Single-select supports opening, choosing a value, and closing with Escape.
  let trigger = page.getByRole('combobox', {name: 'Carrier', exact: true})
  await trigger.click()
  let menu = page.getByRole('listbox')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-single-open')
  await page.getByRole('option', {name: 'AA'}).click()
  await expect(trigger).toContainText('AA')
  expect(await lastParamUpdate(page, 'carrier')).toEqual({name: 'carrier', value: 'AA'})
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()

  // Multi-select keeps sorted options and supports its bulk footer actions.
  trigger = page.getByRole('combobox', {name: 'Carriers'})
  await trigger.click()
  let optionLabels = await menu.locator('[role="option"] .dropdown-option-label').allTextContents()
  expect(optionLabels).toEqual([...optionLabels].sort((a, b) => a.localeCompare(b, undefined, {numeric: true})))
  await page.getByRole('button', {name: 'Select all'}).click()
  await expect(menu.locator('.dropdown-option.is-selected')).toHaveCount(optionLabels.length)
  expect(await lastParamUpdate(page, 'carrier_multi')).toEqual({name: 'carrier_multi', value: {mode: 'exclude', values: []}})
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-multi-select-all')
  await page.getByRole('button', {name: 'Clear selection'}).click()
  await expect(trigger).toContainText('Pick carriers')
  expect(await lastParamUpdate(page, 'carrier_multi')).toEqual({name: 'carrier_multi', value: {mode: 'include', values: []}})
  await page.keyboard.press('Escape')
})

test('dropdown supports search and keyboard navigation', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="carrier_search" data="dropdown_options" value="code" label="label" title="Carrier Search" />
    <Dropdown name="carrier_keys" data="dropdown_options" value="code" label="label" title="Keyboard Carrier" />
  `,
  )
  await startParamTracking(page)

  // Search filters matching options and renders its empty state.
  let trigger = page.getByRole('combobox', {name: 'Carrier Search'})
  let menu = page.getByRole('listbox')
  await trigger.click()
  let search = menu.getByPlaceholder('Carrier Search')
  await search.fill('AA')
  await expect.poll(async () => await menu.locator('[role="option"]').count()).toBeGreaterThan(0)
  expect((await menu.locator('[role="option"]').allTextContents()).every(text => text.includes('AA'))).toBe(true)
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-search-filtered')
  await search.fill('zzz')
  await expect(menu.getByText('No results found')).toBeVisible()
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-search-empty')
  await page.keyboard.press('Escape')

  // Keyboard navigation opens the final dropdown, moves its active option, and selects it.
  trigger = page.getByRole('combobox', {name: 'Keyboard Carrier'})
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  let initialActive = await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()
  await menu.press('ArrowDown')
  expect(await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()).not.toEqual(initialActive)
  await menu.press('Enter')
  await expect(trigger).not.toContainText('Select option')
  expect((await lastParamUpdate(page, 'carrier_keys'))?.name).toBe('carrier_keys')
})

test('dropdown defaultValue and disabled state render correctly', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="carrier_default" data="dropdown_options" value="code" label="label" title="Default Carrier" defaultValue="AA" />
    <Dropdown name="carrier_disabled" data="dropdown_options" value="code" label="label" title="Disabled Carrier" disabled=true defaultValue="AS" />
  `,
  )

  let defaultTrigger = page.getByRole('combobox', {name: 'Default Carrier'})
  await expect(defaultTrigger).toContainText('AA')
  await defaultTrigger.click()
  await expect(page.getByRole('option', {name: 'AA'})).toHaveAttribute('aria-selected', 'true')
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('dropdown-default-value')
  await page.keyboard.press('Escape')

  let disabledTrigger = page.getByRole('combobox', {name: 'Disabled Carrier'})
  await expect(disabledTrigger).toBeDisabled()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(disabledTrigger).screenshot('dropdown-disabled')
})

test('dropdown validates single and multiple defaults against loaded options', async ({server, page}) => {
  let browserWarnings: string[] = []
  page.on('console', message => {
    if (message.type() === 'warning' && message.text().startsWith('[Graphene] ')) browserWarnings.push(message.text())
  })

  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="invalid_default" data="dropdown_options" value="code" label="label" title="Invalid Default" multiple=true defaultValue="AA, AS" />
    <Dropdown name="valid_defaults" data="dropdown_options" value="code" label="label" title="Valid Defaults" multiple=true defaultValue="['AA', 'AS']" />
  `,
  )

  await expect(page.getByRole('combobox', {name: 'Valid Defaults'})).toContainText('AA')
  await expect(page.getByRole('combobox', {name: 'Valid Defaults'})).toContainText('AS')

  await expect
    .poll(() => page.evaluate(() => window.$GRAPHENE.getErrors().map(({message, componentId, severity}) => ({message, componentId, severity}))))
    .toEqual([
      {
        message: 'Dropdown "invalid_default" default value is not present in its options: "AA, AS". For multiple defaults, pass a JSON array string such as "[\'one\', \'two\']".',
        componentId: 'Dropdown defaultValue (name="invalid_default")',
        severity: 'warn',
      },
    ])
  expect(browserWarnings).toContain(
    '[Graphene] Dropdown defaultValue (name="invalid_default"): Dropdown "invalid_default" default value is not present in its options: "AA, AS". For multiple defaults, pass a JSON array string such as "[\'one\', \'two\']".',
  )
})

test('dropdown boolean-string attributes handle defaults and footer actions', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown
      name="carrier_no_default"
      data="dropdown_options"
      value="code"
      label="label"
      title="No Default Carrier"
      defaultValue="AA"
      noDefault="true"
      placeholder="Choose a carrier"
      description="Pick exactly one carrier"
      hideDuringPrint="false"
    />
    <Dropdown
      name="carrier_all"
      data="dropdown_options"
      value="code"
      label="label"
      title="All Carriers"
      multiple="true"
      selectAllByDefault="true"
      disableSelectAll="true"
    />
  `,
  )

  let noDefaultTrigger = page.getByRole('combobox', {name: 'No Default Carrier'})
  await expect(noDefaultTrigger).toContainText('Choose a carrier')
  await expect(page.locator('label[for="dropdown-carrier_no_default"] + .input-description')).toHaveText('Pick exactly one carrier')
  await expect(page.locator('#dropdown-carrier_no_default').locator('xpath=ancestor::div[contains(@class, "input-block")]')).not.toHaveClass(/hide-print/)

  await noDefaultTrigger.click()
  await expect(page.getByRole('option', {name: 'AA'})).toHaveAttribute('aria-selected', 'false')
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('dropdown-no-default-boolean-string')
  await page.keyboard.press('Escape')

  let allTrigger = page.getByRole('combobox', {name: 'All Carriers'})
  await expect(allTrigger).toContainText('selected')
  await allTrigger.click()
  await expect(page.getByRole('button', {name: 'Select all'})).toHaveCount(0)
  await expect(page.getByRole('button', {name: 'Clear selection'})).toBeEnabled()
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('dropdown-select-all-default-disable-button')
})

test('static dropdown options apply select-all as each option registers', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="all_books" title="All Books" multiple=true selectAllByDefault=true>
      <DropdownOption value="open" valueLabel="Has open AR" />
      <DropdownOption value="past_due" valueLabel="Has past due AR" />
      <DropdownOption value="all" valueLabel="All customers" />
    </Dropdown>
  `,
  )

  await page.getByRole('combobox', {name: 'All Books'}).click()
  await expect(page.getByRole('listbox').locator('.dropdown-option.is-selected')).toHaveCount(3)
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('dropdown-manual-select-all-default')
})

test('multiselect URL state escapes commas inside values', async ({server, page}) => {
  await loadDropdownPage(
    server,
    page,
    `
    <Dropdown name="markets" title="Markets" multiple=true>
      <DropdownOption value="North, East" />
      <DropdownOption value="South" />
    </Dropdown>
  `,
  )

  await page.getByRole('combobox', {name: 'Markets'}).click()
  await page.getByRole('option', {name: 'North, East'}).click()
  await expect.poll(() => readSearchParams(page)).toEqual({markets: 'i:North\\, East'})

  await page.reload()
  await waitForGrapheneLoad(page)
  await page.getByRole('combobox', {name: 'Markets'}).click()
  await expect(page.getByRole('option', {name: 'North, East'})).toHaveAttribute('aria-selected', 'true')
})

test('multiselects choose compact URL modes and apply them to query results', async ({server, page}) => {
  let queryBodies: any[] = []
  server.mockFile(
    '/index.md',
    `
    # Multiselect filters

    \`\`\`sql carrier_options
    from flights select carrier as code group by 1 order by 1
    \`\`\`

    <Dropdown name=included_carriers data=carrier_options value=code title="Included carriers" multiple=true />
    <Dropdown name=allowed_carriers data=carrier_options value=code title="Allowed carriers" multiple=true selectAllByDefault=true />

    \`\`\`sql filtered_carriers
    from flights
    where carrier in ($included_carriers) and carrier in ($allowed_carriers)
    select carrier, count() as flights group by 1 order by 1
    \`\`\`

    <BarChart title="Filtered carriers" data=filtered_carriers x=carrier y=flights />
  `,
  )
  await page.route('**/_api/query', async route => {
    queryBodies.push(route.request().postDataJSON())
    await route.continue()
  })

  let filteredRequests = () => queryBodies.filter(body => body.gsql.includes('carrier in ($included_carriers)'))

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect.poll(() => filteredRequests().at(-1)?.params).toEqual({included_carriers: {mode: 'include', values: []}, allowed_carriers: {mode: 'exclude', values: []}})
  await expect.poll(() => readSearchParams(page)).toEqual({})

  await page.getByRole('combobox', {name: 'Included carriers'}).click()
  await page.getByRole('option', {name: 'AA'}).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => readSearchParams(page)).toEqual({included_carriers: 'i:AA'})
  await expect.poll(() => filteredRequests().at(-1)?.params).toEqual({included_carriers: {mode: 'include', values: ['AA']}, allowed_carriers: {mode: 'exclude', values: []}})

  await page.getByRole('combobox', {name: 'Included carriers'}).click()
  await page.getByRole('option', {name: 'DL'}).click()
  await page.keyboard.press('Escape')

  await page.getByRole('combobox', {name: 'Allowed carriers'}).click()
  await page.getByRole('option', {name: 'AA'}).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => readSearchParams(page)).toEqual({included_carriers: 'i:AA,DL', allowed_carriers: 'e:AA'})
  await expect.poll(() => filteredRequests().at(-1)?.params).toEqual({included_carriers: {mode: 'include', values: ['AA', 'DL']}, allowed_carriers: {mode: 'exclude', values: ['AA']}})
  await expect(page.locator('.echarts')).screenshot('dropdown-multiselect-exclude-mode')

  // Once only a few values remain selected, the select-all dropdown switches to the smaller inclusion list.
  await page.getByRole('combobox', {name: 'Allowed carriers'}).click()
  await page.getByRole('button', {name: 'Clear selection'}).click()
  await expect.poll(() => filteredRequests().at(-1)?.params.allowed_carriers).toEqual({mode: 'include', values: []})
  await page.getByRole('option', {name: 'AA'}).click()
  await expect.poll(() => readSearchParams(page)).toEqual({included_carriers: 'i:AA,DL', allowed_carriers: 'i:AA'})
  await expect.poll(() => filteredRequests().at(-1)?.params).toEqual({included_carriers: {mode: 'include', values: ['AA', 'DL']}, allowed_carriers: {mode: 'include', values: ['AA']}})
  await page.getByRole('combobox', {name: 'Allowed carriers'}).click()
  await expect(page.locator('.echarts')).screenshot('dropdown-multiselect-include-mode')
})

test('dropdown supports manual options and labelField mapping', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Input Playground

    \`\`\`sql dropdown_option_labels
    from flights select carrier as code, concat(carrier, ' carrier') as pretty group by 1, 2 order by 1
    \`\`\`

    <Dropdown name="manual_carrier" label="Manual Carrier" description="Manual option set" placeholder="Pick manual" hideDuringPrint="false">
      <DropdownOption value="AA" valueLabel="American" />
      <DropdownOption value="UA" valueLabel="United" />
      <DropdownOption value="DL" valueLabel="Delta" />
    </Dropdown>

    <Dropdown name="label_field_carrier" data="dropdown_option_labels" value="code" labelField="pretty" title="Label Field Carrier" />
  `,
  )
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  let manualTrigger = page.getByRole('combobox', {name: 'Manual Carrier'})
  await expect(manualTrigger).toContainText('Pick manual')
  await expect(page.locator('label[for="dropdown-manual_carrier"] + .input-description')).toHaveText('Manual option set')
  await expect(page.locator('#dropdown-manual_carrier').locator('xpath=ancestor::div[contains(@class, "input-block")]')).not.toHaveClass(/hide-print/)

  await startParamTracking(page)
  await manualTrigger.click()
  await page.getByRole('option', {name: 'United'}).click()
  await expect(manualTrigger).toContainText('United')
  await expect.poll(async () => await lastParamUpdate(page, 'manual_carrier')).toEqual({name: 'manual_carrier', value: 'UA'})

  let mappedTrigger = page.getByRole('combobox', {name: 'Label Field Carrier'})
  await mappedTrigger.click()
  await expect(page.getByRole('option', {name: 'AA carrier'})).toBeVisible()
  await lockOpenDropdownWidth(page)
  await expect(page.getByRole('listbox')).screenshot('dropdown-manual-and-label-field')
})

test('renders a crowded input row', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Crowded input row

    <Row>
      <TextInput name="origin" title="Origin" />
      <TextInput name="destination" title="Destination" />
      <TextInput name="carrier" title="Carrier" />
      <TextInput name="flight" title="Flight number" />
      <TextInput name="tail" title="Tail number" />
    </Row>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.locator('main#content')).screenshot('inputs-crowded-row')

  await page.setViewportSize({width: 500, height: 620})
  await expect(page.locator('main#content')).screenshot('inputs-crowded-row-wrapped')
})

test('text input and date range render label, description, placeholder, and print visibility attrs', async ({mount, sharedPage}) => {
  await mount('components/TextInput.svelte', {
    name: 'search_label',
    label: 'Search Label',
    description: 'Filter rows by keyword',
    hideDuringPrint: 'false',
  })
  let textInput = sharedPage.getByLabel('Search Label')
  await expect(textInput).toHaveAttribute('placeholder', 'Type to search')
  await expect(sharedPage.locator('#component-test .input-description')).toHaveText('Filter rows by keyword')
  await expect(sharedPage.locator('#component-test .input-block')).not.toHaveClass(/hide-print/)
  await expect(sharedPage.locator('#component-test')).screenshot('text-input-label-description-print')

  await mount('components/DateRange.svelte', {
    name: 'period',
    label: 'Period Label',
    description: 'Select reporting period',
    start: '2024-01-01',
    end: '2024-01-31',
    presetRanges: 'Last Month',
    defaultValue: 'Last Month',
    hideDuringPrint: 'false',
  })

  await expect(sharedPage.getByLabel('Period Label')).toBeVisible()
  await expect(sharedPage.locator('#component-test .input-description')).toHaveText('Select reporting period')
  await expect(sharedPage.locator('#component-test .input-block')).not.toHaveClass(/hide-print/)
  await expect(sharedPage.locator('#daterange-period-start')).toHaveValue('2024-01-01')
  await expect(sharedPage.locator('#daterange-period-end')).toHaveValue('2024-02-01')
  await expect(sharedPage.locator('.preset-select')).toHaveValue('Last Month')
  await expect(sharedPage.locator('#component-test')).screenshot('date-range-label-description-default-preset')
})

test('text input updates params and date range applies preset', async ({mount, sharedPage}) => {
  await mount('components/TextInput.svelte', {name: 'search_text', title: 'Search Text', defaultValue: 'alpha', placeholder: 'Type here'})
  let textInput = sharedPage.getByLabel('Search Text')
  await expect(textInput).toHaveValue('alpha')

  await startParamTracking(sharedPage)
  await textInput.fill('del')
  await sharedPage.waitForTimeout(100)
  await textInput.fill('delta')
  await sharedPage.waitForTimeout(150)
  expect(await lastParamUpdate(sharedPage, 'search_text')).toBeNull()
  await expect.poll(() => lastParamUpdate(sharedPage, 'search_text')).toEqual({name: 'search_text', value: 'delta'})
  await textInput.blur()
  await expect(sharedPage.locator('#component-test')).screenshot('text-input-basic')

  await mount('components/DateRange.svelte', {
    name: 'window',
    title: 'Window',
    start: '2024-01-01',
    end: '2024-01-31',
    presetRanges: ['Last 7 Days'],
  })
  await startParamTracking(sharedPage)

  await sharedPage.locator('#daterange-window-start').evaluate((el: HTMLInputElement) => {
    el.value = '2024-01-05'
    el.dispatchEvent(new Event('change', {bubbles: true}))
  })
  let updates = await allParamUpdates(sharedPage)
  expect(updates).toContainEqual({name: 'window_start', value: '2024-01-05'})

  await sharedPage.locator('.preset-select').selectOption('Last 7 Days')
  await expect(sharedPage.locator('#daterange-window-start')).toHaveValue('2024-01-25')
  await expect(sharedPage.locator('#daterange-window-end')).toHaveValue('2024-02-01')
  await expect(sharedPage.locator('#component-test')).screenshot('date-range-preset')
})

test('hidden input applies URL values and defaults without rendering a control', async ({server, page}) => {
  let queryBodies: any[] = []
  server.mockFile(
    '/index.md',
    `
    # Hidden input

    <Hidden name="carrier" defaultValue="AA" />

    \`\`\`sql selected_flights
    from flights select carrier where carrier = $carrier limit 5
    \`\`\`

    <Table data="selected_flights" />
  `,
  )
  await page.route('**/_api/query', async route => {
    queryBodies.push(route.request().postDataJSON())
    await route.continue()
  })

  await page.goto(server.url() + '/?carrier=UA')
  await waitForGrapheneLoad(page)
  expect(queryBodies.some(body => body.params.carrier === 'UA')).toBe(true)
  await expect(page.locator('main#content')).screenshot('hidden-input-url-param')

  queryBodies = []
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  expect(queryBodies.some(body => body.params.carrier === 'AA')).toBe(true)
  await expect(page.locator('main#content').locator('input, button, select')).toHaveCount(0)
})

test('inputs sync url state on load, change, and reload', {timeout: 20000}, async ({server, page}) => {
  let queryBodies: any[] = []
  server.mockFile(
    '/index.md',
    `
    # Synced Inputs

    \`\`\`sql carrier_options
    from flights select carrier as code, carrier as label group by 1 order by 1
    \`\`\`

    <TextInput name="search_text" title="Search Text" defaultValue="alpha" />
    <Dropdown name="carrier_multi" data="carrier_options" value="code" label="label" title="Carriers" multiple=true />
    <Dropdown name="carrier_all" data="carrier_options" value="code" label="label" title="All Carriers" multiple=true selectAllByDefault=true />
    <DateRange name="window" title="Window" start="2024-01-01" end="2024-01-31" />

    \`\`\`sql filtered_flights
    from flights select carrier
    where ($search_text is null or carrier = carrier)
      and ($carrier_multi is null or carrier in ($carrier_multi))
      and carrier in ($carrier_all)
      and ($window_start is null or dep_time >= $window_start)
      and ($window_end is null or dep_time < $window_end)
    limit 5
    \`\`\`

    <Table data="filtered_flights" />
  `,
  )

  await page.route('**/_api/query', async route => {
    queryBodies.push(route.request().postDataJSON())
    await route.continue()
  })

  await page.goto(server.url() + '/?search_text=delta&carrier_multi=AA&carrier_multi=UA&window_start=2024-01-05&window_end=2024-01-12')
  await waitForGrapheneLoad(page)

  await expect(page.getByLabel('Search Text')).toHaveValue('delta')
  await expect(page.getByRole('combobox', {name: 'Carriers', exact: true})).toContainText('AA')
  await expect(page.getByRole('combobox', {name: 'Carriers', exact: true})).toContainText('UA')
  await expect(page.getByRole('combobox', {name: 'All Carriers'})).toContainText('selected')
  expect(await page.evaluate(() => new URLSearchParams(location.search).has('carrier_all'))).toBe(false)
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-05')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-01-12')
  await expect(page.locator('.preset-select')).toHaveValue('Last 7 Days')
  expect(
    queryBodies.some(body =>
      body.params.search_text == 'delta' && body.params.carrier_multi?.mode == 'include' && body.params.carrier_multi?.values.join(',') == 'AA,UA' &&
      body.params.carrier_all?.mode == 'exclude' && body.params.carrier_all?.values.length == 0 &&
      body.params.window_start == '2024-01-05' && body.params.window_end == '2024-01-12'),
  ).toBe(true)

  await page.getByLabel('Search Text').fill('omega')
  await expect.poll(() => queryBodies.some(body => body.params.search_text === 'omega')).toBe(true)
  await page.getByRole('combobox', {name: 'Carriers', exact: true}).click()
  await page.getByRole('option', {name: 'DL'}).click()
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', {name: 'All Carriers'}).click()
  await page.getByRole('option', {name: 'AA'}).click()
  await page.locator('#daterange-window-start').evaluate((el: HTMLInputElement) => {
    el.value = '2024-01-08'
    el.dispatchEvent(new Event('change', {bubbles: true}))
  })
  await expect.poll(() => queryBodies.some(body => JSON.stringify(body.params.carrier_all) === JSON.stringify({mode: 'exclude', values: ['AA']}))).toBe(true)
  await expect
    .poll(() => readSearchParams(page))
    .toEqual({
      search_text: 'omega',
      carrier_multi: 'i:AA,UA,DL',
      carrier_all: 'e:AA',
      window_start: '2024-01-08',
      window_end: '2024-01-12',
    })

  await page.reload()
  await waitForGrapheneLoad(page)
  await expect(page.getByLabel('Search Text')).toHaveValue('omega')
  await expect(page.getByRole('combobox', {name: 'Carriers', exact: true})).toContainText('AA')
  await expect(page.getByRole('combobox', {name: 'Carriers', exact: true})).toContainText('UA')
  await expect(page.getByRole('combobox', {name: 'Carriers', exact: true})).toContainText('DL')
  await page.getByRole('combobox', {name: 'All Carriers'}).click()
  await expect(page.getByRole('option', {name: 'AA'})).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByRole('option', {name: 'UA'})).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-08')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-01-12')
})

test('inputs resync from url changes after navigation events', async ({server, page}) => {
  let queryBodies: any[] = []
  server.mockFile(
    '/index.md',
    `
    # Synced Inputs

    \`\`\`sql carrier_options
    from flights select carrier as code, carrier as label group by 1 order by 1
    \`\`\`

    <TextInput name="search_text" title="Search Text" defaultValue="alpha" />
    <Dropdown name="carrier_multi" data="carrier_options" value="code" label="label" title="Carriers" multiple=true />
    <DateRange name="window" title="Window" start="2024-01-01" end="2024-01-31" />

    \`\`\`sql filtered_flights
    from flights select carrier
    where ($search_text is null or carrier = carrier)
      and ($carrier_multi is null or carrier in ($carrier_multi))
      and ($window_start is null or dep_time >= $window_start)
      and ($window_end is null or dep_time < $window_end)
    limit 5
    \`\`\`

    <Table data="filtered_flights" />
  `,
  )

  await page.route('**/_api/query', async route => {
    queryBodies.push(route.request().postDataJSON())
    await route.continue()
  })

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  await page.evaluate(() => {
    history.pushState({}, '', '?search_text=sigma&carrier_multi=DL&window_start=2024-01-10&window_end=2024-01-20')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByLabel('Search Text')).toHaveValue('sigma')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('DL')
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-10')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-01-20')
  await expect
    .poll(() => queryBodies[queryBodies.length - 1]?.params)
    .toEqual({
      search_text: 'sigma',
      carrier_multi: {mode: 'include', values: ['DL']},
      window_start: '2024-01-10',
      window_end: '2024-01-20',
    })

  await page.evaluate(() => {
    history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByLabel('Search Text')).toHaveValue('alpha')
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-01')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-01-31')
})
