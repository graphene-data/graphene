import {StytchB2BUIClient, AuthFlowType, StytchEventType} from '@stytch/vanilla-js/b2b'

export function createAuthClient () {
  if (import.meta.env.MODE == 'test' && import.meta.env.VITE_STYTCH_USE_MOCK) {
    return {
      session: {
        getSync () {
          return {}
        },
      },
    }
  }

  return new StytchB2BUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN)
}

export {AuthFlowType, StytchEventType}
