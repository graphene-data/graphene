# CLI Telemetry

This directory contains the Graphene CLI telemetry client. It emits a small set of product-usage events to help us understand CLI adoption and behavior without sending query text, markdown contents, or project names.

Telemetry is enabled when:

- the CLI has a non-empty telemetry endpoint
- `GRAPHENE_TELEMETRY_DISABLED` is not set to `1`
- `graphene.telemetry` is not set to `false` in project config

The default endpoint is `https://app.graphenedata.com/cli-telemetry`. Tests and local development can override it with `GRAPHENE_TELEMETRY_ENDPOINT`.

## Common fields

Every event includes these fields:

- `install_id`: A random UUID generated once and persisted in the local Graphene config store. It identifies a CLI installation, not a user account or machine owner.
- `project_hash`: A SHA-256 hash of the nearest `package.json` `name`, prefixed with `graphene:` before hashing. This lets us distinguish projects without sending the raw package name.
- `cli_version`: The Graphene CLI version.
- `timestamp`: The event time in ISO-8601 format.
- `ci`: Whether the CLI appears to be running in CI.
- `node_platform`: The Node platform, such as `darwin` or `linux`.
- `node_version`: The Node runtime version.

## Event types

### `cli_command_started`

Sent at the start of every tracked CLI command.

Fields:

- `command`: One of `check`, `compile`, `login`, `run`, `schema`, `serve`, or `stop`
- `flags`: A sorted list of safe flag names that were present

Only a small allowlist of flag names is tracked:

- `run`: `query`, `chart`
- `serve`: `bg`

We do not send flag values.

### `cli_command_completed`

Sent at the end of every tracked CLI command, regardless of success or failure.

Fields:

- `command`
- `success`
- `exit_code`
- `duration_ms`

### `cli_install_seen`

Sent after a successful command only on the first successful version ever seen for an installation.

After that first install event, later version changes emit `cli_upgraded` instead of another `cli_install_seen`.

### `cli_upgraded`

Sent after a successful command when the current CLI version is new for this installation and differs from the last successfully seen version.

If an installation later switches back to a version it has already used successfully before, no `cli_upgraded` event is sent.

Fields:

- `from_version`
- `to_version`

### `workspace_scanned`

Sent once per CLI process, at the first point where the current command scans the Graphene workspace.

It is currently emitted only for:

- `check`
- `compile`
- `run`
- `serve`

Fields:

- `command`
- `gsql_file_count`
- `md_file_count`

## When events fire

The typical sequence for a successful command is:

1. `cli_command_started`
2. `workspace_scanned` if that command scans the workspace and no earlier command in the same process already emitted it
3. `cli_install_seen` if this is the first successful run ever recorded for this installation
4. `cli_upgraded` if the installation previously succeeded on a different CLI version and the current version has not been seen before on this installation
5. `cli_command_completed`

For a failed command, the CLI still sends:

1. `cli_command_started`
2. `workspace_scanned` if applicable
3. `cli_command_completed`

`cli_install_seen` and `cli_upgraded` are only emitted after successful command completion, and a single successful run will emit at most one of them.

## Transport behavior

Events are sent as HTTP `POST` requests with a JSON batch envelope:

```json
{
  "events": [
    {
      "event": "cli_command_started"
    }
  ]
}
```

The client currently sends one event per request as `{events: [event]}`.

Telemetry is best-effort:

- requests use a short timeout
- send failures are ignored
- telemetry should not affect normal CLI behavior
