# Configuration

Graphene reads its configuration from the `graphene` object in your project's `package.json`. The installer (`npm create graphene`) generates a starter config; this page lists every supported field.

```json
{
  "graphene": {
    "duckdb": {"path": "./data.duckdb"},
    "defaultNamespace": "main",
    "ignoredFiles": ["drafts/**"],
    "envFile": [".env", "../../.env"],
    "updateNotifier": false
  }
}
```

Changes to `package.json` are read once at startup, so restart the dev server (`graphene serve --bg`) after editing.

# General options

## `defaultNamespace`

The schema/database used to resolve unqualified table names in GSQL. For BigQuery this is typically `project.dataset`; for Snowflake `DATABASE.SCHEMA`; for DuckDB usually `main`. Also accepted as `namespace`.

## `ignoredFiles`

An array of glob patterns for files that Graphene should skip when discovering `.gsql` and `.md` files. Patterns are matched relative to the project root using the [`glob`](https://www.npmjs.com/package/glob) package's syntax (case-insensitive).

```json
"ignoredFiles": ["drafts/**"]
```

`node_modules/**`, hidden directories (`.git/`, `.claude/`, etc.), `readme.md`, and the agent-instruction files `agents.md` and `claude.md` are always ignored regardless of this setting.

## `envFile`

Path (or array of paths) to `.env` files Graphene should load before connecting to your database. Defaults to `['.env']`. Useful when sharing credentials across multiple Graphene projects in a monorepo:

```json
"envFile": [".env", "../../.env"]
```

## `port`

Port for the local dev server. Defaults to `4000`, or the value of the `GRAPHENE_PORT` environment variable.

## `host`

Hostname the dev server binds to. Defaults to `localhost`.

## `telemetry`

Set to `false` to opt out of anonymous usage telemetry.

## `updateNotifier`

Set to `false` to opt out of CLI update notices. You can also set `GRAPHENE_NO_UPDATE_NOTIFIER=1` in the environment.

# Database connections

Exactly one of the following blocks should be present. The dialect is inferred from whichever one you set.

## `motherduck`

```json
"motherduck": {"database": "sample_data"}
```

- `database` — MotherDuck database name to open with `md:<database>`. If omitted, Graphene opens `md:` and attaches all databases available to the token.

MotherDuck uses DuckDB SQL syntax, so Graphene analyzes GSQL with the DuckDB dialect. Store credentials in a `.env` file and include it with `envFile`:

```env
MOTHERDUCK_TOKEN=<your-token>
```

## `duckdb`

```json
"duckdb": {"path": "./data.duckdb"}
```

- `path` — path to the `.duckdb` file, relative to the project root. If omitted, Graphene runs in-memory.

## `snowflake`

```json
"snowflake": {
  "account": "myorg-myaccount",
  "username": "graphene_user",
  "privateKeyPath": "/Users/me/.ssh/graphene_snowflake_key.p8",
  "database": "ANALYTICS",
  "schema": "PUBLIC"
}
```

- `account` — Snowflake account identifier (`org-account`).
- `username` — service account username.
- `privateKeyPath` — absolute path to the `.p8` private key. Usually set via the `SNOWFLAKE_PRI_KEY_PATH` env var instead.
- `authenticator` — optional Snowflake authenticator: `SNOWFLAKE_JWT`, `OAUTH_AUTHORIZATION_CODE`, or `EXTERNALBROWSER`. Defaults to `SNOWFLAKE_JWT` when `privateKeyPath` or `SNOWFLAKE_PRI_KEY_PATH` is set; otherwise `graphene login` defaults to `OAUTH_AUTHORIZATION_CODE`, using Snowflake's built-in local application OAuth flow.
- `database`, `schema` — optional defaults applied to unqualified queries.

The matching private key passphrase env var is `SNOWFLAKE_PRI_PASSPHRASE`.

## `bigquery`

```json
"bigquery": {
  "projectId": "my-project-123",
  "keyPath": "/Users/me/.ssh/graphene-bq-key.json"
}
```

- `projectId` — Google Cloud project ID for billing/jobs.
- `keyPath` — absolute path to the service account JSON key. Usually set via the `GOOGLE_APPLICATION_CREDENTIALS` env var instead.

## `clickhouse`

```json
"clickhouse": {
  "url": "https://example.clickhouse.cloud:8443",
  "username": "default",
  "database": "default",
  "requestTimeout": 30000
}
```

- `url` — full ClickHouse endpoint URL including protocol and port.
- `username` — ClickHouse user.
- `database` — default database for unqualified queries.
- `requestTimeout` — per-request timeout in milliseconds.

The matching password env var is `CLICKHOUSE_PASSWORD`.

## `postgres`

```json
"postgres": {
  "host": "localhost",
  "port": 5432,
  "database": "analytics",
  "user": "graphene_user",
  "schema": "public"
}
```

- `connectionString` — full Postgres connection string. If omitted, Graphene also checks `POSTGRES_URL` and `DATABASE_URL`.
- `host`, `port`, `database`, `user`/`username` — connection fields used when no connection string is set. These can also come from the matching `PG*` or `POSTGRES_*` env vars.
- `schema` — default schema for unqualified table names. Falls back to `defaultNamespace`, then `public`.
- `ssl`, `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `queryTimeout`, `statementTimeout` — passed through to `node-postgres`.
