import {getContext, setContext} from 'svelte'
import {readable, type Readable} from 'svelte/store'

type Appearance = 'light'

type Theme = {
  colors: Record<string, string>
  colorPalettes: Record<string, string[]>
}

type ThemeStores = {
  activeAppearance: Readable<Appearance>
  theme: Readable<Theme>
  resolveColor: <T>(input: T) => Readable<T | string | undefined>
  resolveColorsObject: (input: Record<string, unknown> | string | undefined) => Readable<Record<string, string | undefined> | undefined>
  resolveColorPalette: (input: unknown) => Readable<string[] | undefined>
}

const THEME_CONTEXT = Symbol('GrapheneThemeStores')

const DEFAULT_PALETTE = ['#EE9174', '#59A48B', '#D6AFC6', '#78B0D5', '#D5AE4E', '#C16864', '#A7CCC3']

const DEFAULT_THEME: Theme = {
  colors: {
    'base-100': '#ffffff',
    'base-200': '#f6f6f6',
    'base-300': '#e5e7eb',
    'base-content': '#1f2937',
    'base-content-muted': '#6b7280',
    primary: '#EE9174',
    positive: '#16a34a',
    negative: '#dc2626',
    warning: '#d97706',
  },
  colorPalettes: {
    default: DEFAULT_PALETTE,
  },
}

const activeAppearance = readable<Appearance>('light')
const theme = readable<Theme>(DEFAULT_THEME)

const isReadable = <T>(value: unknown): value is Readable<T> => {
  return Boolean(value && typeof value === 'object' && 'subscribe' in (value as any))
}

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const normalizeColor = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (Array.isArray(value)) return normalizeColor(value[0])
  if (typeof value !== 'string') return String(value)

  let trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed === 'true' || trimmed === 'false') return trimmed
  if (DEFAULT_THEME.colors[trimmed]) return DEFAULT_THEME.colors[trimmed]
  let lower = trimmed.toLowerCase()
  if (trimmed.startsWith('#')) return trimmed
  if (lower.startsWith('rgb') || lower.startsWith('hsl')) return trimmed
  return trimmed
}

export const resolveColor = <T>(input: T): Readable<T | string | undefined> => {
  if (isReadable<T | string | undefined>(input)) return input
  return readable(normalizeColor(input) as T | string | undefined)
}

export const resolveColorsObject = (input: Record<string, unknown> | string | undefined): Readable<Record<string, string | undefined> | undefined> => {
  if (isReadable<Record<string, string | undefined> | undefined>(input)) return input
  if (!input) return readable(undefined)

  let record: Record<string, unknown> | undefined = input as Record<string, unknown>
  if (typeof input === 'string') {
    let parsed = parseJson(input.trim())
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      record = parsed as Record<string, unknown>
    } else {
      return readable(undefined)
    }
  }

  if (!record) return readable(undefined)

  let entries = Object.entries(record).map(([key, value]) => [key, normalizeColor(value)] as const)
  return readable(Object.fromEntries(entries))
}

export const resolveColorPalette = (input: unknown): Readable<string[] | undefined> => {
  if (isReadable<string[] | undefined>(input)) return input
  if (input == null) return readable(DEFAULT_PALETTE)

  if (typeof input === 'string') {
    let key = input.trim()
    if (!key || key === 'default') return readable(DEFAULT_PALETTE)
    if (DEFAULT_THEME.colorPalettes[key]) return readable(DEFAULT_THEME.colorPalettes[key])
    if (key.startsWith('[')) {
      let parsed = parseJson(key)
      if (Array.isArray(parsed)) {
        let values = parsed.map(item => normalizeColor(item)).filter(Boolean) as string[]
        return readable(values.length ? values : DEFAULT_PALETTE)
      }
    }
    if (key.includes(',')) {
      let values = key
        .split(',')
        .map(part => normalizeColor(part))
        .filter(Boolean) as string[]
      return readable(values.length ? values : DEFAULT_PALETTE)
    }
    let normalized = normalizeColor(key)
    return readable(normalized ? [normalized] : DEFAULT_PALETTE)
  }

  if (Array.isArray(input)) {
    let values = input.map(item => normalizeColor(item)).filter(Boolean) as string[]
    return readable(values.length ? values : DEFAULT_PALETTE)
  }

  return readable(DEFAULT_PALETTE)
}

export const getThemeStores = (): ThemeStores => {
  let stores = getContext<ThemeStores | undefined>(THEME_CONTEXT)
  if (!stores) {
    stores = {activeAppearance, theme, resolveColor, resolveColorsObject, resolveColorPalette}
    setContext(THEME_CONTEXT, stores)
  }
  return stores
}
