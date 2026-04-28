export type TelemetryCommand = 'check' | 'compile' | 'list' | 'login' | 'run' | 'schema' | 'serve' | 'stop'

export interface TelemetryState {
  installId: string
  installSeenVersions: string[]
  lastSeenVersion?: string
}

export interface CommonEventFields {
  install_id: string
  project_hash?: string
  cli_version: string
  timestamp: string
  ci: boolean
  node_platform: NodeJS.Platform
  node_version: string
}

export interface TelemetryPayloads {
  cli_install_seen: undefined
  cli_upgraded: {
    from_version: string
    to_version: string
  }
  workspace_scanned: {
    command: 'check' | 'compile' | 'list' | 'run' | 'serve'
    gsql_file_count: number
    md_file_count: number
  }
  cli_command_started: {
    command: TelemetryCommand
    flags: string[]
  }
  cli_command_completed: {
    command: TelemetryCommand
    success: boolean
    exit_code: number
    duration_ms: number
  }
}

export type TelemetryEventName = keyof TelemetryPayloads
export type TelemetryEventFor<K extends TelemetryEventName> = CommonEventFields & {event: K} & (TelemetryPayloads[K] extends undefined ? object : TelemetryPayloads[K])
export type TelemetryEvent = {[K in TelemetryEventName]: TelemetryEventFor<K>}[TelemetryEventName]

export type CliInstallSeenEvent = TelemetryEventFor<'cli_install_seen'>
export type CliUpgradedEvent = TelemetryEventFor<'cli_upgraded'>
export type WorkspaceScannedEvent = TelemetryEventFor<'workspace_scanned'>
export type CliCommandStartedEvent = TelemetryEventFor<'cli_command_started'>
export type CliCommandCompletedEvent = TelemetryEventFor<'cli_command_completed'>

export interface TelemetryBatch {
  events: TelemetryEvent[]
}
