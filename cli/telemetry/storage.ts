import Conf from 'conf'
import {randomUUID} from 'node:crypto'

import type {TelemetryState} from './types.ts'

export class TelemetryStorage {
  private store = new Conf<TelemetryState>({
    configName: 'telemetry',
    defaults: {
      installId: randomUUID(),
      installSeenVersions: [],
    },
    projectName: 'graphene',
  })

  read(): TelemetryState {
    return this.store.store
  }

  get installId() {
    return this.store.get('installId')
  }

  markSuccessfulInvocation(cliVersion: string) {
    let state = this.read()
    let hasSeenVersion = state.installSeenVersions.includes(cliVersion)
    let shouldSendInstallSeen = !state.lastSeenVersion && state.installSeenVersions.length == 0
    let fromVersion = !hasSeenVersion && state.lastSeenVersion && state.lastSeenVersion != cliVersion ? state.lastSeenVersion : undefined

    this.store.set('lastSeenVersion', cliVersion)
    this.store.set('installSeenVersions', [...new Set([...state.installSeenVersions, cliVersion])])

    return {shouldSendInstallSeen, fromVersion}
  }
}
