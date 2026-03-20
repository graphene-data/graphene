import {expect, test, waitForGrapheneLoad} from './fixtures.ts'

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width: 900, height: 620})
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
    let originalUpdateParams = w.$GRAPHENE.updateParams?.bind(w.$GRAPHENE)
    w.$GRAPHENE.updateParam = (name: string, value: unknown) => {
      w.__paramUpdates.push({name, value})
      return originalUpdateParam(name, value)
    }
    if (originalUpdateParams) {
      w.$GRAPHENE.updateParams = (values: Record<string, unknown>) => {
        Object.entries(values).forEach(([name, value]) => {
          w.__paramUpdates.push({name, value})
        })
        return originalUpdateParams(values)
      }
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

test('dropdown single-select supports open, select, and close behaviors', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier" data="dropdown_options" value="code" label="label" title="Carrier" />')
  let trigger = page.getByRole('combobox', {name: 'Carrier'})
  await expect(trigger).toBeVisible()

  await startParamTracking(page)
  await trigger.click()
  let menu = page.getByRole('listbox')
  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-single-open')

  await page.getByRole('option', {name: 'AA'}).click()
  await expect(trigger).toContainText('AA')
  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await lastParamUpdate(page, 'carrier')).toEqual({name: 'carrier', value: 'AA'})

  await trigger.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('dropdown multi-select supports select-all and clear', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_multi" data="dropdown_options" value="code" label="label" title="Carriers" multiple=true placeholder="Pick carriers" />')
  let trigger = page.getByRole('combobox', {name: 'Carriers'})

  await startParamTracking(page)
  await trigger.click()
  let menu = page.getByRole('listbox')
  await expect(menu).toBeVisible()

  let optionLabels = await menu.locator('[role="option"] .dropdown-option-label').allTextContents()
  let sortedOptionLabels = [...optionLabels].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
  expect(optionLabels).toEqual(sortedOptionLabels)

  await page.getByRole('button', {name: 'Select all'}).click()
  await expect(trigger).toContainText('selected')
  await expect(menu.locator('.dropdown-option.is-selected')).toHaveCount(optionLabels.length)
  expect(await lastParamUpdate(page, 'carrier_multi')).toEqual({name: 'carrier_multi', value: optionLabels})
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-multi-select-all')

  await page.getByRole('button', {name: 'Clear selection'}).click()
  await expect(trigger).toContainText('Pick carriers')
  await expect(page.getByRole('button', {name: 'Clear selection'})).toBeDisabled()
  expect(await lastParamUpdate(page, 'carrier_multi')).toEqual({name: 'carrier_multi', value: null})
})

test('dropdown search filters options and shows empty state', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_search" data="dropdown_options" value="code" label="label" title="Carrier Search" />')
  let trigger = page.getByRole('combobox', {name: 'Carrier Search'})

  await trigger.click()
  let menu = page.getByRole('listbox')
  let search = menu.getByPlaceholder('Carrier Search')
  await search.fill('AA')
  await expect.poll(async () => await menu.locator('[role="option"]').count()).toBeGreaterThan(0)
  let filteredOptions = await menu.locator('[role="option"]').allTextContents()
  expect(filteredOptions.every(text => text.includes('AA'))).toBe(true)
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-search-filtered')

  await search.fill('zzz')
  await expect(menu.getByText('No results found')).toBeVisible()
  await expect(page.getByRole('option')).toHaveCount(0)
  await lockOpenDropdownWidth(page)
  await expect(menu).screenshot('dropdown-search-empty')
})

test('dropdown keyboard navigation selects active option', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_keys" data="dropdown_options" value="code" label="label" title="Keyboard Carrier" />')
  let trigger = page.getByRole('combobox', {name: 'Keyboard Carrier'})

  await startParamTracking(page)
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  let menu = page.getByRole('listbox')
  await expect(menu).toBeVisible()
  let initialActive = await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()
  await menu.press('ArrowDown')
  let movedActive = await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()
  expect(movedActive).not.toEqual(initialActive)

  await menu.press('Enter')
  await expect(trigger).not.toContainText('Select option')
  await expect(menu).toBeHidden()
  let update = await lastParamUpdate(page, 'carrier_keys')
  expect(update?.name).toBe('carrier_keys')
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

test('text input and date range render label, description, placeholder, and print visibility attrs', async ({mount, page}) => {
  await mount('components/TextInput.svelte', {
    name: 'search_label',
    label: 'Search Label',
    description: 'Filter rows by keyword',
    hideDuringPrint: 'false',
  })
  let textInput = page.getByLabel('Search Label')
  await expect(textInput).toHaveAttribute('placeholder', 'Type to search')
  await expect(page.locator('#component-test .input-description')).toHaveText('Filter rows by keyword')
  await expect(page.locator('#component-test .input-block')).not.toHaveClass(/hide-print/)
  await expect(page.locator('#component-test')).screenshot('text-input-label-description-print')

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

  await expect(page.getByLabel('Period Label')).toBeVisible()
  await expect(page.locator('#component-test .input-description')).toHaveText('Select reporting period')
  await expect(page.locator('#component-test .input-block')).not.toHaveClass(/hide-print/)
  await expect(page.locator('#daterange-period-start')).toHaveValue('2024-01-01')
  await expect(page.locator('#daterange-period-end')).toHaveValue('2024-02-01')
  await expect(page.locator('.preset-select')).toHaveValue('Last Month')
  await expect(page.locator('#component-test')).screenshot('date-range-label-description-default-preset')
})

test('text input updates params and date range applies preset', async ({mount, page}) => {
  await mount('components/TextInput.svelte', {name: 'search_text', title: 'Search Text', defaultValue: 'alpha', placeholder: 'Type here'})
  let textInput = page.getByLabel('Search Text')
  await expect(textInput).toHaveValue('alpha')

  await startParamTracking(page)
  await textInput.fill('delta')
  expect(await lastParamUpdate(page, 'search_text')).toEqual({name: 'search_text', value: 'delta'})
  await textInput.blur()
  await expect(page.locator('#component-test')).screenshot('text-input-basic')

  await mount('components/DateRange.svelte', {
    name: 'window',
    title: 'Window',
    start: '2024-01-01',
    end: '2024-01-31',
    presetRanges: ['Last 7 Days'],
  })
  await startParamTracking(page)

  await page.locator('#daterange-window-start').evaluate((el: HTMLInputElement) => {
    el.value = '2024-01-05'
    el.dispatchEvent(new Event('change', {bubbles: true}))
  })
  let updates = await allParamUpdates(page)
  expect(updates).toContainEqual({name: 'window_start', value: '2024-01-05'})

  await page.locator('.preset-select').selectOption('Last 7 Days')
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-25')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-02-01')
  await expect(page.locator('#component-test')).screenshot('date-range-preset')
})

test('inputs sync url state on load, change, and reload', async ({server, page}) => {
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

  await page.goto(server.url() + '/?search_text=delta&carrier_multi=AA&carrier_multi=UA&window_start=2024-01-05&window_end=2024-01-12')
  await waitForGrapheneLoad(page)

  await expect(page.getByLabel('Search Text')).toHaveValue('delta')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('AA')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('UA')
  await expect(page.locator('#daterange-window-start')).toHaveValue('2024-01-05')
  await expect(page.locator('#daterange-window-end')).toHaveValue('2024-01-12')
  await expect(page.locator('.preset-select')).toHaveValue('Last 7 Days')
  expect(
    queryBodies.some(
      body =>
        JSON.stringify(body.params) ===
        JSON.stringify({
          search_text: 'delta',
          carrier_multi: ['AA', 'UA'],
          window_start: '2024-01-05',
          window_end: '2024-01-12',
        }),
    ),
  ).toBe(true)

  await page.getByLabel('Search Text').fill('omega')
  await page.getByRole('combobox', {name: 'Carriers'}).click()
  await page.getByRole('option', {name: 'DL'}).click()
  await page.locator('#daterange-window-start').evaluate((el: HTMLInputElement) => {
    el.value = '2024-01-08'
    el.dispatchEvent(new Event('change', {bubbles: true}))
  })
  await expect
    .poll(() => readSearchParams(page))
    .toEqual({
      search_text: 'omega',
      carrier_multi: ['AA', 'UA', 'DL'],
      window_start: '2024-01-08',
      window_end: '2024-01-12',
    })

  await page.reload()
  await waitForGrapheneLoad(page)
  await expect(page.getByLabel('Search Text')).toHaveValue('omega')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('AA')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('UA')
  await expect(page.getByRole('combobox', {name: 'Carriers'})).toContainText('DL')
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
      carrier_multi: ['DL'],
      window_start: '2024-01-10',
      window_end: '2024-01-20',
    })
})
