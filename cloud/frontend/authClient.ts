import {StytchB2BUIClient, AuthFlowType, StytchEventType, type MemberSession} from '@stytch/vanilla-js/b2b'
import {writable} from 'svelte/store'

// Determine the base domain for cookies and redirects based on current hostname
function getBaseDomain(): string {
  if (import.meta.env.DEV) return window.location.host
  if (window.location.hostname.endsWith('.graphene-staging.com')) return 'graphene-staging.com'
  return 'graphenedata.com'
}

export const baseDomain = getBaseDomain()
export const loginUrl = import.meta.env.DEV ? `${window.location.origin}/login` : `https://login.${baseDomain}/login`

let _client: StytchB2BUIClient | null = null

export function authClient(): StytchB2BUIClient {
  if (_client) return _client
  if (import.meta.env.MODE == 'test' && import.meta.env.VITE_STYTCH_USE_MOCK) {
    _client = new MockClient() as StytchB2BUIClient
  } else {
    _client = new StytchB2BUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN, {
      cookieOptions: {
        availableToSubdomains: true,
        domain: baseDomain,
      },
    })
  }
  return _client
}

class MockClient {
  session = {
    getSync() {
      return {}
    },
  }
}

export const session = writable<MemberSession | null>(authClient().session.getSync() || null)

export {AuthFlowType, StytchEventType}
