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

const DEFAULT_PALETTE = ['#4C78A8', '#F58518', '#E45756', '#72B7B2', '#54A24B', '#EECA3B', '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC']

const DEFAULT_THEME: Theme = {
  colors: {
    'base-100': '#ffffff',
    'base-200': '#f6f6f6',
    'base-300': '#e5e7eb',
    'base-content': '#1f2937',
    'base-content-muted': '#6b7280',
    primary: '#3D6B7E',
    positive: '#87A68C',
    negative: '#B87470',
    warning: '#D4A94C',
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

const cssVar = (name: string): string | undefined => {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return undefined
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined
}

// A single color makes a flat scale; expand to a bg→color gradient so heatmaps work.
// chroma.scale needs a real color, so resolve the CSS var before building the palette.
const finalizePalette = (values: string[]): string[] => {
  if (values.length === 0) return DEFAULT_PALETTE
  if (values.length === 1) return [cssVar('--color-bg') ?? DEFAULT_THEME.colors['base-100'], values[0]]
  return values
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
        return readable(finalizePalette(values))
      }
    }
    if (key.includes(',')) {
      let values = key
        .split(',')
        .map(part => normalizeColor(part))
        .filter(Boolean) as string[]
      return readable(finalizePalette(values))
    }
    let normalized = normalizeColor(key)
    return readable(normalized ? finalizePalette([normalized]) : DEFAULT_PALETTE)
  }

  if (Array.isArray(input)) {
    let values = input.map(item => normalizeColor(item)).filter(Boolean) as string[]
    return readable(finalizePalette(values))
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
