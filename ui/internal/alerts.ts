// Each compiled markdown page owns an alert registry in Svelte context. Targets subscribe by id;
// Cloud supplies evaluation state when mounting; local pages default to hover-only definitions.
import {getContext, setContext} from 'svelte'
import {writable, type Writable} from 'svelte/store'

export interface PageAlert {
  id: string
  above?: number | string
  below?: number | string
  every: string
  to: string
  key?: string
  value?: string
  triggeredKeys?: unknown[][]
}
export type AlertStates = Record<string, {triggeredKeys: unknown[][]; lastError: string | null}>
export type AlertStore = Writable<Record<string, PageAlert[]>> & {states: AlertStates}
const contextKey = 'graphene-page-alerts'

// Called during the compiled page's initialization, before any child components are created.
export function createAlertStore(states: AlertStates = {}): AlertStore {
  return setContext(contextKey, Object.assign(writable<Record<string, PageAlert[]>>({}), {states}))
}

// Standalone component previews need no provider until they contain alert definitions.
export function getAlertStore(): AlertStore {
  return getContext<AlertStore>(contextKey) || Object.assign(writable({}), {states: {}})
}
