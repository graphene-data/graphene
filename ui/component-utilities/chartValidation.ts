import {onDestroy} from 'svelte'

import type {GrapheneError} from '../../lang/index.d.ts'

import {unsupportedChartProps} from '../../lang/chartProps.ts'
import {clearDiagnosticProvider, diagnosticProvider} from '../internal/telemetry.ts'

let nextValidationId = 0

export function registerChartPropWarnings(componentName: string, props: () => Record<string, unknown>, context?: () => string | undefined) {
  let key = `chart-props:${componentName}:${++nextValidationId}`
  diagnosticProvider(key, () => chartPropWarnings(componentName, props(), context?.()))
  onDestroy(() => clearDiagnosticProvider(key))
}

function chartPropWarnings(componentName: string, props: Record<string, unknown>, context?: string): GrapheneError[] {
  return unsupportedChartProps(componentName, props).map(unsupported => ({
    severity: 'warn',
    queryId: context || componentName,
    message: unsupported.message,
  }))
}

export function chartContext(componentName: string, data: unknown) {
  if (typeof data == 'string') return `${componentName} (data="${data}")`
  return componentName
}
