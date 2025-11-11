import {writable} from 'svelte/store'
import {StytchB2BUIClient, AuthFlowType, StytchEventType, type MemberSession} from '@stytch/vanilla-js/b2b'

let _client: StytchB2BUIClient | null = null

export const session = writable<MemberSession>()

if (import.meta.env.MODE == 'test' && import.meta.env.VITE_STYTCH_USE_MOCK) {
  session.set({} as MemberSession)
}

export function authClient () {
  if (_client) return _client
  if (import.meta.env.MODE == 'test' && import.meta.env.VITE_STYTCH_USE_MOCK) {
    _client = new MockClient() as StytchB2BUIClient
  } else {
    _client = new StytchB2BUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN)
  }
  return _client
}

class MockClient {
  session = {
    getSync () {
      return {}
    },
  }
}

export {AuthFlowType, StytchEventType}
