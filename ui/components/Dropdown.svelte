<script lang="ts">
  import {onMount, setContext, tick, type Snippet} from 'svelte'
  import {DROPDOWN_CONTEXT} from '../component-utilities/dropdownContext'
  import {ensureArray, toBoolean} from '../component-utilities/inputUtils'

  interface Option {
    value: any
    label: string
  }

  interface Props {
    name: string
    data?: string
    value?: string
    label?: string
    optionLabel?: string
    labelField?: string
    title?: string
    placeholder?: string
    multiple?: boolean | string
    defaultValue?: string | string[]
    selectAllByDefault?: boolean | string
    noDefault?: boolean | string
    disableSelectAll?: boolean | string
    hideDuringPrint?: boolean | string
    description?: string
    disabled?: boolean | string
    children?: Snippet
  }

  let {
    name, data = undefined, value = 'value', label = undefined, optionLabel = undefined,
    labelField = undefined, title = undefined, placeholder = 'Select option', multiple = false,
    defaultValue = undefined, selectAllByDefault = false, noDefault = false, disableSelectAll = false,
    hideDuringPrint = true, description = undefined, disabled = false, children = undefined,
  }: Props = $props()

  let mounted = false
  let queryOptions: Option[] = $state([])
  let manualOptions: Option[] = $state([])
  let selection: any[] = $state([])
  let touched = false
  let queryHandler: ((res: {rows?: any[]; error?: any}) => void) | null = null
  let queryKey = ''

  let isOpen = $state(false)
  let searchTerm = $state('')
  let activeIndex = $state(-1)
  let triggerEl: HTMLButtonElement | null = $state(null)
  let menuEl: HTMLDivElement | null = $state(null)
  let searchInput: HTMLInputElement | null = $state(null)

  const registerOption = (opt: Option) => {
    manualOptions = [...manualOptions, opt]
    syncSelection(false)
    return () => {
      manualOptions = manualOptions.filter(o => optionKey(o.value) !== optionKey(opt.value))
      syncSelection(false)
    }
  }
  setContext(DROPDOWN_CONTEXT, registerOption)

  const optionKey = (val: any): string => {
    if (val === null) return 'null'
    if (val === undefined) return 'undefined'
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val)
      } catch {
        return String(val)
      }
    }
    return String(val)
  }

  const combineOptions = (manual: Option[], queried: Option[]) => {
    let map = new Map<string, Option>() // eslint-disable-line svelte/prefer-svelte-reactivity
    for (let opt of [...manual, ...queried]) {
      let key = optionKey(opt.value)
      if (!map.has(key)) map.set(key, opt)
    }
    return Array.from(map.values()).sort((a, b) => String(a.label ?? a.value ?? '').localeCompare(String(b.label ?? b.value ?? ''), undefined, {numeric: true}))
  }

  let multi = $derived(toBoolean(multiple))
  let selectAllDefault = $derived(toBoolean(selectAllByDefault))
  let hasNoDefault = $derived(toBoolean(noDefault))
  let hidePrint = $derived(toBoolean(hideDuringPrint))
  let isDisabled = $derived(toBoolean(disabled))
  let disableSelectAllButton = $derived(toBoolean(disableSelectAll))

  let resolvedLabelField = $derived(optionLabel || labelField || (label && data ? label : undefined))
  let resolvedTitle = $derived(title || (!data ? label : undefined))
  let triggerPlaceholder = $derived(placeholder || resolvedTitle || 'Select option')
  let searchPlaceholder = $derived(resolvedTitle || placeholder || 'Search options')

  let availableOptions = $derived(combineOptions(manualOptions, queryOptions))
  let valueMap = $derived(new Map(availableOptions.map(opt => [optionKey(opt.value), opt])))
  let filteredOptions = $derived(filterOptions(availableOptions, searchTerm))
  let selectedDisplayOptions = $derived(selection.map(val => valueMap.get(optionKey(val)) || {value: val, label: String(val ?? '')}))

  $effect(() => {
    if (isOpen) activeIndex = ensureActiveIndex(activeIndex, filteredOptions)
  })

  function setupQuery () {
    if (!mounted) return
    let key = data ? `${data}::${value}::${resolvedLabelField || ''}` : ''
    if (key === queryKey) return
    if (queryHandler) {
      window.$GRAPHENE?.unsubscribe?.(queryHandler)
      queryHandler = null
    }
    queryKey = key
    if (!data) {
      queryOptions = []
      syncSelection(false)
      return
    }
    let columns = [value]
    if (resolvedLabelField && resolvedLabelField !== value) columns.push(resolvedLabelField)
    let handler = (res: {rows?: any[]; error?: any}) => {
      if (res.error) return
      if (!res.rows) return
      queryOptions = res.rows.map(row => ({
        value: row[value],
        label: resolvedLabelField ? row[resolvedLabelField] : row[value],
      }))
      syncSelection(false)
    }
    if (typeof window !== 'undefined' && window.$GRAPHENE?.query) {
      window.$GRAPHENE.query(data, columns, handler)
      queryHandler = handler
    }
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!isOpen) return
    let target = event.target as Node | null
    if (menuEl?.contains(target) || triggerEl?.contains(target)) return
    closeMenu(false)
  }

  function filterOptions (opts: Option[], term: string): Option[] {
    let trimmed = term.trim().toLowerCase()
    if (!trimmed) return opts
    return opts.filter(opt => {
      let text = opt.label ?? opt.value
      return String(text ?? '').toLowerCase().includes(trimmed)
    })
  }

  function ensureActiveIndex (current: number, opts: Option[]): number {
    if (!opts.length) return -1
    if (current >= 0 && current < opts.length) return current
    let selectedIdx = opts.findIndex(opt => isOptionSelected(opt))
    return selectedIdx >= 0 ? selectedIdx : 0
  }

  function isOptionSelected (opt: Option): boolean {
    let key = optionKey(opt.value)
    return selection.some(val => optionKey(val) === key)
  }

  async function focusSearchInput () {
    await tick()
    if (searchInput) searchInput.focus()
  }

  function openMenu (focusSearch = true) {
    if (isDisabled) return
    isOpen = true
    if (focusSearch) focusSearchInput()
  }

  function closeMenu (focusTrigger: boolean) {
    if (!isOpen) return
    isOpen = false
    activeIndex = -1
    searchTerm = ''
    if (focusTrigger) triggerEl?.focus()
  }

  function toggleMenu () {
    if (isDisabled) return
    if (isOpen) {
      closeMenu(false)
    } else {
      openMenu(true)
    }
  }

  function moveActive (delta: number) {
    if (!filteredOptions.length) {
      activeIndex = -1
      return
    }
    let next = activeIndex
    if (next < 0) {
      next = delta > 0 ? 0 : filteredOptions.length - 1
    } else {
      next = (next + delta + filteredOptions.length) % filteredOptions.length
    }
    activeIndex = next
  }

  function selectActiveOption () {
    if (!filteredOptions.length || activeIndex < 0 || activeIndex >= filteredOptions.length) return
    handleOptionSelect(filteredOptions[activeIndex], true)
  }

  function handleTriggerKeydown (event: KeyboardEvent) {
    if (event.defaultPrevented) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isOpen) {
        openMenu(true)
      } else if (event.key === 'ArrowDown') {
        moveActive(1)
      } else if (event.key === 'ArrowUp') {
        moveActive(-1)
      } else if (event.key === 'Enter') {
        selectActiveOption()
      }
    }
  }

  function handleMenuKeydown (event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      if (filteredOptions.length) activeIndex = 0
    } else if (event.key === 'End') {
      event.preventDefault()
      if (filteredOptions.length) activeIndex = filteredOptions.length - 1
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectActiveOption()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
    } else if (event.key === 'Tab') {
      closeMenu(false)
    }
  }

  function handleOptionKeydown (event: KeyboardEvent, opt: Option) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOptionSelect(opt, true)
    }
  }

  function handleOptionSelect (opt: Option, fromKeyboard: boolean) {
    let key = optionKey(opt.value)
    if (multi) {
      let exists = selection.some(val => optionKey(val) === key)
      if (exists) {
        let next = selection.filter(val => optionKey(val) !== key)
        setSelection(next, true)
      } else {
        setSelection([...selection, opt.value], true)
      }
    } else {
      setSelection([opt.value], true)
      closeMenu(fromKeyboard)
    }
  }

  function scrollActiveIntoView () {
    if (!isOpen || activeIndex < 0) return
    let optionEl = menuEl?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    optionEl?.scrollIntoView({block: 'nearest'})
  }

  $effect(() => {
    if (isOpen && activeIndex >= 0) tick().then(scrollActiveIntoView)
  })

  onMount(() => {
    mounted = true
    let defaults = ensureArray(defaultValue)
    if (!hasNoDefault && defaults.length) setSelection(defaults, false)
    syncSelection(false)
    setupQuery()
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', handlePointerDown)
    }
    return () => {
      mounted = false
      if (queryHandler) {
        window.$GRAPHENE?.unsubscribe?.(queryHandler)
        queryHandler = null
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', handlePointerDown)
      }
    }
  })

  $effect(() => {
    setupQuery()
  })

  function syncSelection (fromUser: boolean) {
    let opts = availableOptions
    if (!opts.length) {
      if (selection.length) updateInputPayload(selection)
      return
    }
    let nextSelection = selection.filter(val => valueMap.has(optionKey(val)))
    if (!fromUser) {
      let defaults = ensureArray(defaultValue)
      if (multi && selectAllDefault) {
        nextSelection = opts.map(o => o.value)
      } else if (!touched) {
        if (defaults.length && !hasNoDefault) {
          nextSelection = defaults.filter(val => valueMap.has(optionKey(val)))
        } else if (!multi && !hasNoDefault) {
          nextSelection = selection.length ? nextSelection : []
        }
      }
    }
    setSelection(nextSelection, fromUser)
  }

  function setSelection (values: any[], fromUser: boolean) {
    let keys = values.map(optionKey)
    let existingKeys = selection.map(optionKey)
    let changed = keys.length !== existingKeys.length || keys.some((k, idx) => k !== existingKeys[idx])
    if (!changed) {
      if (!fromUser) updateInputPayload(selection)
      return
    }
    selection = values
    if (fromUser) touched = true
    updateInputPayload(selection)
  }

  function updateInputPayload (values: any[]) {
    let paramValue = values.length ? values[0] : null
    window.$GRAPHENE.updateParam(name, paramValue)
  }

  function selectAll () {
    if (!multi) return
    setSelection(availableOptions.map(opt => opt.value), true)
  }

  function clearSelection () {
    setSelection([], true)
  }

  let elementId = $derived(`dropdown-${name}`)
  let menuId = $derived(`${elementId}-menu`)

  function getContainerClass () {
    if (!hidePrint) return 'input-block'
    return 'input-block hide-print'
  }

  function getDropdownClass () {
    if (!isDisabled) return 'dropdown'
    return 'dropdown is-disabled'
  }

  function getOptionClass (opt: Option, idx: number) {
    let classes = 'dropdown-option'
    if (isOptionSelected(opt)) classes += ' is-selected'
    if (activeIndex === idx) classes += ' is-active'
    return classes
  }
</script>

{@render children?.()}
<div class={getContainerClass()}>
  {#if resolvedTitle}
    <label class="input-label" for={elementId}>{resolvedTitle}</label>
  {/if}
  {#if description}
    <div class="input-description">{description}</div>
  {/if}
  <div class={getDropdownClass()}>
    <button
      bind:this={triggerEl}
      id={elementId}
      class="dropdown-trigger"
      type="button"
      disabled={isDisabled}
      role="combobox"
      aria-label={resolvedTitle || name}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={menuId}
      aria-activedescendant={isOpen && activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined}
      onclick={toggleMenu}
      onkeydown={handleTriggerKeydown}
    >
      <span class="dropdown-trigger-label">
        {#if multi}
          {#if selectedDisplayOptions.length === 0}
            {triggerPlaceholder}
          {:else if selectedDisplayOptions.length > 3}
            <span class="dropdown-badge">{selectedDisplayOptions.length} selected</span>
          {:else}
            {#each selectedDisplayOptions as opt (optionKey(opt.value))}
              <span class="dropdown-badge">{opt.label}</span>
            {/each}
          {/if}
        {:else}
          {#if selectedDisplayOptions.length}
            {selectedDisplayOptions[0].label}
          {:else}
            {triggerPlaceholder}
          {/if}
        {/if}
      </span>
      <span class={`dropdown-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 16 16" role="presentation"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </button>
    {#if isOpen}
      <div
        bind:this={menuEl}
        id={menuId}
        class="dropdown-menu"
        role="listbox"
        tabindex="0"
        aria-multiselectable={multi}
        onkeydown={handleMenuKeydown}
      >
        <div class="dropdown-search">
          <input
            bind:this={searchInput}
            type="text"
            placeholder={searchPlaceholder}
            bind:value={searchTerm}
            class="dropdown-search-input"
          />
        </div>
        <div class="dropdown-options pretty-scrollbar" role="presentation">
          {#if !filteredOptions.length}
            <div class="dropdown-empty">No results found</div>
          {:else}
            {#each filteredOptions as opt, index (optionKey(opt.value))}
              <div
                class={getOptionClass(opt, index)}
                role="option"
                tabindex="-1"
                aria-selected={isOptionSelected(opt)}
                data-index={index}
                id={`${menuId}-option-${index}`}
                onmousedown={(e) => e.preventDefault()}
                onmouseenter={() => activeIndex = index}
                onclick={() => handleOptionSelect(opt, false)}
                onkeydown={(event) => handleOptionKeydown(event, opt)}
              >
                <span class="dropdown-check" aria-hidden="true">
                  {#if multi}
                    <svg viewBox="0 0 16 16">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="13"
                        height="13"
                        rx="3"
                        ry="3"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        class={`checkbox-border${isOptionSelected(opt) ? ' is-filled' : ''}`}
                      />
                      {#if isOptionSelected(opt)}
                        <path d="M4 8l2.5 2.5L12 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="checkbox-checkmark" />
                      {/if}
                    </svg>
                  {:else}
                    <svg viewBox="0 0 16 16">
                      <path
                        d="M4 6l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class={`checkmark${isOptionSelected(opt) ? ' is-visible' : ''}`}
                      />
                    </svg>
                  {/if}
                </span>
                <span class="dropdown-option-label">{opt.label}</span>
              </div>
            {/each}
          {/if}
        </div>
        {#if multi}
          <div class="dropdown-footer">
            {#if !disableSelectAllButton}
              <button type="button" class="dropdown-footer-action" onclick={(event) => { event.stopPropagation(); event.preventDefault(); selectAll() }}>Select all</button>
            {/if}
            <button
              type="button"
              class="dropdown-footer-action"
              disabled={!selection.length}
              onclick={(event) => { event.stopPropagation(); event.preventDefault(); clearSelection() }}
            >
              Clear selection
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .input-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }
  .hide-print {
    /* Hide during print */
  }
  @media print {
    .hide-print {
      display: none !important;
    }
  }
  .input-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--input-label-color, #374151);
  }
  .input-description {
    font-size: 12px;
    color: rgba(55, 65, 81, 0.8);
  }
  .dropdown {
    position: relative;
    display: inline-block;
    width: 220px;
  }
  .dropdown.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #1f2937;
    font-size: 14px;
    font-family: "Inter", var(--ui-font-family, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif);
    line-height: 1.2;
    box-sizing: border-box;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  .dropdown-trigger:hover {
    border-color: #94a3b8;
  }
  .dropdown-trigger:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.25);
    outline-offset: 2px;
  }
  .dropdown-trigger[disabled] {
    cursor: not-allowed;
    background: #f3f4f6;
    color: #94a3b8;
  }
  .dropdown-trigger-label {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dropdown-badge {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    border-radius: 6px;
    background: #e2e8f0;
    color: #1f2937;
    font-size: 12px;
    line-height: 20px;
    white-space: nowrap;
  }
  .dropdown-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    transition: transform 120ms ease;
  }
  .dropdown-caret svg {
    width: 16px;
    height: 16px;
  }
  .dropdown-caret.is-open {
    transform: rotate(180deg);
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 100%;
    z-index: 40;
    background: #ffffff;
    color: #1f2937;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
    padding: 10px 0 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dropdown-search {
    padding: 0 16px;
  }
  .dropdown-search-input {
    width: 100%;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    padding: 6px 10px;
    font-size: 13px;
    font-family: "Inter", var(--ui-font-family, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif);
    line-height: 1.2;
    background: #f9fafb;
    color: inherit;
    box-sizing: border-box;
    appearance: none;
    -webkit-appearance: none;
  }
  .dropdown-search-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }
  .dropdown-options {
    max-height: 220px;
    overflow-y: auto;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background 100ms ease, color 100ms ease;
    color: #1f2937;
  }
  .dropdown-option:hover,
  .dropdown-option.is-active {
    background: #f1f5f9;
  }
  .dropdown-option.is-selected {
    font-weight: 600;
  }
  .dropdown-option.is-selected .dropdown-check {
    color: #2563eb;
  }
  .dropdown-option-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dropdown-check {
    display: inline-flex;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
  }
  .dropdown-check svg {
    width: 18px;
    height: 18px;
  }
  .dropdown-option.is-selected .dropdown-check {
    color: #2563eb;
  }
  .checkbox-border.is-filled {
    fill: #2563eb;
    stroke: #2563eb;
  }
  .dropdown-option.is-selected .checkbox-checkmark {
    stroke: #ffffff;
  }
  .checkmark {
    opacity: 0;
    stroke: #2563eb;
  }
  .checkmark.is-visible {
    opacity: 1;
  }
  .dropdown-empty {
    padding: 12px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
  .dropdown-footer {
    display: flex;
    gap: 12px;
    padding: 8px 16px 0 16px;
    border-top: 1px solid #e5e7eb;
  }
  .dropdown-footer-action {
    border: none;
    background: none;
    color: #2563eb;
    font-size: 13px;
    font-family: "Inter", var(--ui-font-family, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif);
    cursor: pointer;
    padding: 4px 0;
  }
  .dropdown-footer-action[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .dropdown-footer-action:hover:not([disabled]) {
    text-decoration: underline;
  }
</style>
