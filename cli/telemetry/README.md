# CLI Telemetry

This directory contains the Graphene CLI telemetry client. It emits a small set of product-usage events to help us understand CLI adoption and behavior without sending query text, markdown contents, or project names.

Telemetry is enabled when:

- the CLI has a non-empty telemetry endpoint
- `GRAPHENE_TELEMETRY_DISABLED` is not set to `1`
- `graphene.telemetry` is not set to `false` in project config

The default endpoint is `https://app.graphenedata.com/cli-telemetry`. Cloud projects use `/cli-telemetry` on their configured Cloud origin so Cloud can attribute authenticated events. Tests and local development can override it with `GRAPHENE_TELEMETRY_ENDPOINT`.

Install ID persistence is best-effort. The ID is stored in the current project's `node_modules/.graphene/telemetry.json` when `node_modules` already exists. If the project cache cannot be read or written, the CLI uses an ephemeral ID and command behavior does not change.

## Common fields

Every event includes these fields:

- `install_id`: A random UUID generated once and persisted in the local Graphene project cache. It identifies a project-local CLI installation, not a user account or machine owner.
- `project_hash`: A SHA-256 hash of the package name and sanitized database destination. Depending on the dialect, the destination uses the Cloud URL, database file, project/account, or server host and database. Credentials, usernames, and URL query parameters are excluded before hashing.
- `repo_slug`: For Cloud projects, the repo slug configured in the Cloud URL. Cloud resolves it only within the authenticated organization.
- `cli_version`: The Graphene CLI version.
- `timestamp`: The event time in ISO-8601 format.
- `agent`: The known agent harness that invoked the CLI, when one can be detected from inherited environment markers. Unknown explicit agent names are reported as `other`; raw environment values and agent session IDs are never sent.
- `ci`: Whether the CLI appears to be running in CI. CI does not disable telemetry.
- `node_platform`: The Node platform, such as `darwin` or `linux`.
- `node_version`: The Node runtime version.

## Event types

### `cli_command_started`

Sent at the start of every tracked CLI command.

Fields:

- `command`: One of `check`, `compile`, `list`, `login`, `run`, `schema`, `serve`, or `stop`
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

### `workspace_scanned`

Sent once per CLI process, at the first point where the current command scans the Graphene workspace.

It is currently emitted only for:

- `check`
- `compile`
- `list`
- `run`
- `serve`

Fields:

- `command`
- `gsql_file_count`
- `md_file_count`

## When events fire

Every tracked command sends:

1. `cli_command_started`
2. `workspace_scanned` if the command scans the workspace
3. `cli_command_completed`, whether the command succeeds or fails

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

Cloud projects attach an existing, unexpired login token or `GRAPHENE_TOKEN`. Telemetry never refreshes credentials or prompts for login. Cloud derives the user and organization from that token; missing or invalid credentials remain anonymous.

Telemetry is best-effort:

- requests use a short timeout
- send failures are ignored
- telemetry should not affect normal CLI behavior
