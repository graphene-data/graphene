import {config} from '../lang/config.ts'
import {analyzeAll, analyzeWorkspace, loadWorkspace} from '../lang/core.ts'
import {printDiagnostics} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

interface CheckOptions {
  fileArg?: string
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

export async function check(options: CheckOptions): Promise<boolean> {
  let log = options.log || console.log
  let targetFile = options.fileArg

  let workspace = await loadWorkspace({config, files: []})
  options.telemetry?.event('workspace_scanned', {command: 'check', ...getWorkspaceScanCounts(workspace)})

  let res
  if (targetFile) {
    workspace.files = workspace.files.filter(file => file.path.endsWith('.gsql') || file.path == targetFile)
    res = analyzeWorkspace(workspace, targetFile)
  } else {
    res = analyzeAll(workspace)
  }
  if (res.diagnostics.length > 0) {
    printDiagnostics(res.diagnostics, log)
    return false
  }

  log('No errors found 💎')
  return true
}
