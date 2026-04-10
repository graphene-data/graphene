export type TelemetryCommand = 'check' | 'compile' | 'login' | 'run' | 'schema' | 'serve' | 'stop'

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

export interface CliInstallSeenEvent extends CommonEventFields {
  event: 'cli_install_seen'
}

export interface CliUpgradedEvent extends CommonEventFields {
  event: 'cli_upgraded'
  from_version: string
  to_version: string
}

export interface WorkspaceScannedEvent extends CommonEventFields {
  event: 'workspace_scanned'
  command: 'check' | 'compile' | 'run' | 'serve'
  gsql_file_count: number
  md_file_count: number
}

export interface CliCommandStartedEvent extends CommonEventFields {
  event: 'cli_command_started'
  command: TelemetryCommand
  flags: string[]
}

export interface CliCommandCompletedEvent extends CommonEventFields {
  event: 'cli_command_completed'
  command: TelemetryCommand
  success: boolean
  exit_code: number
  duration_ms: number
}

export type TelemetryEvent = CliInstallSeenEvent | CliUpgradedEvent | WorkspaceScannedEvent | CliCommandStartedEvent | CliCommandCompletedEvent

export interface TelemetryBatch {
  events: TelemetryEvent[]
}
