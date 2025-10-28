type ErrorProvider = () => Error[]

window.$GRAPHENE = {getErrors}

let staticErrors: Error[] = []
let errorProviders: Record<string, ErrorProvider> = {}

window.addEventListener('error', (event) => {
  staticErrors.push(event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  staticErrors.push(event.reason)
})

export function error (e: Error, ctx?: any) {
  staticErrors.push(e)
}

export function errorProvider (key:string, fn: ErrorProvider) {
  errorProviders[key] = fn
}

export function getErrors (): Error[] {
  return staticErrors.concat(Object.values(errorProviders)
    .flatMap(p => p()))
}
