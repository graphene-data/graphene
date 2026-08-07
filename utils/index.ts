// Shared fetch behavior for Core and Cloud clients. Successful responses remain standard Response objects;
// failed responses become useful errors from JSON API bodies or plain-text proxy/server failures.

// Uses the fetch API, returning successful responses and throwing a decoded error for unsuccessful ones.
export async function gFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init)
  if (response.ok) return response

  let text = await response.text()
  let body: any = text
  try {
    if (text) body = JSON.parse(text)
  } catch {
    // Proxies and load balancers often return plain text or HTML even when the API normally returns JSON.
  }
  let message = typeof body == 'string' ? body : body?.message || body?.error
  let error = new Error(message || `Request failed with HTTP ${response.status}`)
  if (body && typeof body == 'object') Object.assign(error, body)
  Object.assign(error, {status: response.status})
  throw error
}
