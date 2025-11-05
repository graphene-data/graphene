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

export function logError (e: Error | string, ctx?: any) {
  if (typeof e === 'string') e = new Error(e)
  if (ctx) Object.assign(e, ctx)
  staticErrors.push(e)
}

export function errorProvider (key:string, fn: ErrorProvider) {
  errorProviders[key] = fn
}

export function getErrors (): Error[] {
  let provided = Object.values(errorProviders).flatMap(p => p())
  return staticErrors.concat(provided)
}
