import type {GrapheneError} from '../../lang/index.d.ts'

type ErrorProvider = () => GrapheneError[]
type DiagnosticProvider = () => GrapheneError[]

window.$GRAPHENE ||= {}
window.$GRAPHENE.getErrors = getErrors
window.$GRAPHENE.getDiagnostics = getDiagnostics

let staticDiagnostics: GrapheneError[] = []
let diagnosticProviders: Record<string, DiagnosticProvider> = {}

window.addEventListener('error', event => {
  if ((event.error?.message || '').match(/Failed to fetch dynamically imported module.*\.md\?import/)) return
  let err = event.error instanceof Error ? event.error : new Error(String(event.error))
  staticDiagnostics.push({message: err.message, stack: err.stack})
})
window.addEventListener('unhandledrejection', event => {
  let err = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  staticDiagnostics.push({message: err.message, stack: err.stack})
})

export function logError(error: unknown, ctx?: Partial<GrapheneError>) {
  let err = error instanceof Error ? error : new Error(String(error))
  staticDiagnostics.push({message: err.message, stack: err.stack, ...ctx})
}

export function errorProvider(key: string, fn: ErrorProvider) {
  diagnosticProviders[key] = fn
}

export function diagnosticProvider(key: string, fn: DiagnosticProvider) {
  diagnosticProviders[key] = fn
}

export function clearDiagnosticProvider(key: string) {
  delete diagnosticProviders[key]
}

export function getDiagnostics(): GrapheneError[] {
  let provided = Object.values(diagnosticProviders).flatMap(p => p())
  return staticDiagnostics.concat(provided)
}

export function getErrors(): GrapheneError[] {
  return getDiagnostics().filter(d => d.severity != 'warn')
}
