import {StytchB2BUIClient, AuthFlowType, StytchEventType} from '@stytch/vanilla-js/b2b'

export function createAuthClient () {
  // if (process.env.NODE_ENV == 'test' && (window as any).MOCK_AUTH) {
  //   return {getSessionSync}
  // }

  return new StytchB2BUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN)
}

export {AuthFlowType, StytchEventType}
