import {StytchB2BUIClient, AuthFlowType, StytchEventType} from '@stytch/vanilla-js/b2b'

const isTestEnv = import.meta.env?.VITE_NODE_ENV === 'test' || import.meta.env.MODE === 'test'
const useMock = isTestEnv && import.meta.env.VITE_STYTCH_USE_MOCK === 'true'

export function createAuthClient () {
  if (!useMock) return new StytchB2BUIClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN)
  let client = new MockAuthClient()
  if (typeof window !== 'undefined') (window as any).__AUTH_CLIENT__ = client
  return client as unknown as StytchB2BUIClient
}

class MockAuthClient {
  #session: unknown = null
  #mountConfig: any

  session = {
    getSync: () => this.#session,
  }

  mount (config: any) {
    this.#mountConfig = config
  }

  getMountConfig () {
    return this.#mountConfig
  }

  setSession (session: unknown) {
    this.#session = session
  }

  completeLogin (session: {member_id: string, organization_id: string} = {member_id: 'mock-member', organization_id: 'mock-org'}) {
    this.#session = {member_session: session}
    this.#mountConfig?.callbacks?.onEvent?.({type: StytchEventType.AuthenticateFlowComplete, member_session: session})
  }
}

declare global {
  interface Window {
    __AUTH_CLIENT__?: MockAuthClient
  }
}

export {AuthFlowType, StytchEventType}
