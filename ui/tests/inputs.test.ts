import {expect, test, waitForGrapheneLoad} from './fixtures.ts'

const pageFrame = (page: any) => page.frameLocator('iframe[title="Graphene page"]')
const loadedFrame = (page: any) => page.frames().find((frame: any) => frame.url().includes('/_graphene/frame/'))

test.beforeEach(async ({page, sharedPage}) => {
  await sharedPage.setViewportSize({width: 900, height: 620})
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
  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let trigger = frame.getByRole('combobox', {name: 'Carrier'})
  await expect(trigger).toBeVisible()

  await startParamTracking(frameWindow)
  await trigger.click()
  let menu = frame.getByRole('listbox')
  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await lockOpenDropdownWidth(frameWindow)
  await expect(menu).screenshot('dropdown-single-open')

  await frame.getByRole('option', {name: 'AA'}).click()
  await expect(trigger).toContainText('AA')
  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await lastParamUpdate(frameWindow, 'carrier')).toEqual({name: 'carrier', value: 'AA'})

  await trigger.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('dropdown multi-select supports select-all and clear', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_multi" data="dropdown_options" value="code" label="label" title="Carriers" multiple=true placeholder="Pick carriers" />')
  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let trigger = frame.getByRole('combobox', {name: 'Carriers'})

  await startParamTracking(frameWindow)
  await trigger.click()
  let menu = frame.getByRole('listbox')
  await expect(menu).toBeVisible()

  let optionLabels = await menu.locator('[role="option"] .dropdown-option-label').allTextContents()
  let sortedOptionLabels = [...optionLabels].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
  expect(optionLabels).toEqual(sortedOptionLabels)

  await frame.getByRole('button', {name: 'Select all'}).click()
  await expect(trigger).toContainText('selected')
  await expect(menu.locator('.dropdown-option.is-selected')).toHaveCount(optionLabels.length)
  expect(await lastParamUpdate(frameWindow, 'carrier_multi')).toEqual({name: 'carrier_multi', value: optionLabels})
  await lockOpenDropdownWidth(frameWindow)
  await expect(menu).screenshot('dropdown-multi-select-all')

  await frame.getByRole('button', {name: 'Clear selection'}).click()
  await expect(trigger).toContainText('Pick carriers')
  await expect(frame.getByRole('button', {name: 'Clear selection'})).toBeDisabled()
  expect(await lastParamUpdate(frameWindow, 'carrier_multi')).toEqual({name: 'carrier_multi', value: null})
})

test('dropdown search filters options and shows empty state', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_search" data="dropdown_options" value="code" label="label" title="Carrier Search" />')
  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let trigger = frame.getByRole('combobox', {name: 'Carrier Search'})

  await trigger.click()
  let menu = frame.getByRole('listbox')
  let search = menu.getByPlaceholder('Carrier Search')
  await search.fill('AA')
  await expect.poll(async () => await menu.locator('[role="option"]').count()).toBeGreaterThan(0)
  let filteredOptions = await menu.locator('[role="option"]').allTextContents()
  expect(filteredOptions.every(text => text.includes('AA'))).toBe(true)
  await lockOpenDropdownWidth(frameWindow)
  await expect(menu).screenshot('dropdown-search-filtered')

  await search.fill('zzz')
  await expect(menu.getByText('No results found')).toBeVisible()
  await expect(frame.getByRole('option')).toHaveCount(0)
  await lockOpenDropdownWidth(frameWindow)
  await expect(menu).screenshot('dropdown-search-empty')
})

test('dropdown keyboard navigation selects active option', async ({server, page}) => {
  await loadDropdownPage(server, page, '<Dropdown name="carrier_keys" data="dropdown_options" value="code" label="label" title="Keyboard Carrier" />')
  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let trigger = frame.getByRole('combobox', {name: 'Keyboard Carrier'})

  await startParamTracking(frameWindow)
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  let menu = frame.getByRole('listbox')
  await expect(menu).toBeVisible()
  let initialActive = await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()
  await menu.press('ArrowDown')
  let movedActive = await menu.locator('.dropdown-option.is-active .dropdown-option-label').textContent()
  expect(movedActive).not.toEqual(initialActive)

  await menu.press('Enter')
  await expect(trigger).not.toContainText('Select option')
  await expect(menu).toBeHidden()
  let update = await lastParamUpdate(frameWindow, 'carrier_keys')
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

  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let defaultTrigger = frame.getByRole('combobox', {name: 'Default Carrier'})
  await expect(defaultTrigger).toContainText('AA')
  await defaultTrigger.click()
  await expect(frame.getByRole('option', {name: 'AA'})).toHaveAttribute('aria-selected', 'true')
  await lockOpenDropdownWidth(frameWindow)
  await expect(frame.getByRole('listbox')).screenshot('dropdown-default-value')
  await page.keyboard.press('Escape')

  let disabledTrigger = frame.getByRole('combobox', {name: 'Disabled Carrier'})
  await expect(disabledTrigger).toBeDisabled()
  await expect(frame.getByRole('listbox')).toHaveCount(0)
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

  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let noDefaultTrigger = frame.getByRole('combobox', {name: 'No Default Carrier'})
  await expect(noDefaultTrigger).toContainText('Choose a carrier')
  await expect(frame.locator('label[for="dropdown-carrier_no_default"] + .input-description')).toHaveText('Pick exactly one carrier')
  await expect(frame.locator('#dropdown-carrier_no_default').locator('xpath=ancestor::div[contains(@class, "input-block")]')).not.toHaveClass(/hide-print/)

  await noDefaultTrigger.click()
  await expect(frame.getByRole('option', {name: 'AA'})).toHaveAttribute('aria-selected', 'false')
  await lockOpenDropdownWidth(frameWindow)
  await expect(frame.getByRole('listbox')).screenshot('dropdown-no-default-boolean-string')
  await page.keyboard.press('Escape')

  let allTrigger = frame.getByRole('combobox', {name: 'All Carriers'})
  await expect(allTrigger).toContainText('selected')
  await allTrigger.click()
  await expect(frame.getByRole('button', {name: 'Select all'})).toHaveCount(0)
  await expect(frame.getByRole('button', {name: 'Clear selection'})).toBeEnabled()
  await lockOpenDropdownWidth(frameWindow)
  await expect(frame.getByRole('listbox')).screenshot('dropdown-select-all-default-disable-button')
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

  let frame = pageFrame(page)
  let frameWindow = loadedFrame(page)
  let manualTrigger = frame.getByRole('combobox', {name: 'Manual Carrier'})
  await expect(manualTrigger).toContainText('Pick manual')
  await expect(frame.locator('label[for="dropdown-manual_carrier"] + .input-description')).toHaveText('Manual option set')
  await expect(frame.locator('#dropdown-manual_carrier').locator('xpath=ancestor::div[contains(@class, "input-block")]')).not.toHaveClass(/hide-print/)

  await startParamTracking(frameWindow)
  await manualTrigger.click()
  await frame.getByRole('option', {name: 'United'}).click()
  await expect(manualTrigger).toContainText('United')
  await expect.poll(async () => await lastParamUpdate(frameWindow, 'manual_carrier')).toEqual({name: 'manual_carrier', value: 'UA'})

  let mappedTrigger = frame.getByRole('combobox', {name: 'Label Field Carrier'})
  await mappedTrigger.click()
  await expect(frame.getByRole('option', {name: 'AA carrier'})).toBeVisible()
  await lockOpenDropdownWidth(frameWindow)
  await expect(frame.getByRole('listbox')).screenshot('dropdown-manual-and-label-field')
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
  await textInput.fill('delta')
  expect(await lastParamUpdate(sharedPage, 'search_text')).toEqual({name: 'search_text', value: 'delta'})
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
    <DateRange name="window" title="Window" start="2024-01-01" end="2024-01-31" />

    \`\`\`sql filtered_flights
    from flights select carrier
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

  let frame = pageFrame(page)
  await expect(frame.getByLabel('Search Text')).toHaveValue('delta')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('AA')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('UA')
  await expect(frame.locator('#daterange-window-start')).toHaveValue('2024-01-05')
  await expect(frame.locator('#daterange-window-end')).toHaveValue('2024-01-12')
  await expect(frame.locator('.preset-select')).toHaveValue('Last 7 Days')
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

  await frame.getByLabel('Search Text').fill('omega')
  await frame.getByRole('combobox', {name: 'Carriers'}).click()
  await frame.getByRole('option', {name: 'DL'}).click()
  await frame.locator('#daterange-window-start').evaluate((el: HTMLInputElement) => {
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
  frame = pageFrame(page)
  await expect(frame.getByLabel('Search Text')).toHaveValue('omega')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('AA')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('UA')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('DL')
  await expect(frame.locator('#daterange-window-start')).toHaveValue('2024-01-08')
  await expect(frame.locator('#daterange-window-end')).toHaveValue('2024-01-12')
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
  let frame = pageFrame(page)

  await page.evaluate(() => {
    history.pushState({}, '', '?search_text=sigma&carrier_multi=DL&window_start=2024-01-10&window_end=2024-01-20')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(frame.getByLabel('Search Text')).toHaveValue('sigma')
  await expect(frame.getByRole('combobox', {name: 'Carriers'})).toContainText('DL')
  await expect(frame.locator('#daterange-window-start')).toHaveValue('2024-01-10')
  await expect(frame.locator('#daterange-window-end')).toHaveValue('2024-01-20')
  await expect
    .poll(() => queryBodies[queryBodies.length - 1]?.params)
    .toEqual({
      search_text: 'sigma',
      carrier_multi: ['DL'],
      window_start: '2024-01-10',
      window_end: '2024-01-20',
    })
})
