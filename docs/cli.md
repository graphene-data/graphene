# CLI

Invoke the CLI via your project's package manager (e.g. `pnpm graphene check`, `npm exec graphene run`).

```bash
# `check` is a linter and mainly used when editing .gsql files
graphene check # Check across all .gsql files in the project
graphene check path/to/file.gsql # Check for one specific gsql file
graphene check path/to/page.md # Check for one specific markdown file

# `run` is the primary command for iterating on queries and pages
graphene run "from flights select count() as total" # Run inline Graphene SQL and print results
graphene run "from flights select count() as total" --format csv # Print query results as CSV
graphene run path/to/page.md # Open the page in your system browser and save a full-page screenshot
graphene run path/to/page.md --param carrier=AA # Run the page with param values, overriding page defaults
graphene run - # Read Graphene SQL from stdin and print results

# If `graphene run` works by opening and using existing browser tabs.
# If it fails you may add the --headless flag to open a browser via Playwright, though this is usually not preferred.
graphene install-browser # Install the browser used by `graphene run --headless`

# Running a markdown page starts the local dev server in a persistent background process if one is not already running.
# The command prints the live page URL, e.g. http://localhost:4000/path/to/page, and the server keeps running for hot reloads.
# After iterating until the screenshot looks acceptable, agents can link users directly to that localhost URL.

graphene list path/to/page.md # List out all the component ids on a given page, for use with `graphene run -c`

# `-c/--chart` can target a chart or table title, or the component ID printed by `graphene list`.
graphene run path/to/page.md -c "Chart Title" # Run the page and screenshot one chart/table by title
graphene run path/to/page.md -c 'BarChart (data="query_name" x="category" y="total")' # Run the page and screenshot one chart/table by component ID

# `--param` values are strings. Repeat the flag to pass multiple values for one param.
graphene run path/to/page.md --param carrier=AA --param carrier=DL

graphene compile "[QUERY]" # Show the compiled, dialect-specific SQL. Does not run a query.

# `schema` is for implementation/migration purposes and is NOT for exploring Graphene SQL models
graphene schema # List datasets/schemas in the connected database
graphene schema my_dataset # List schemas (or tables) in a dataset
graphene schema my_dataset.table # Print the Graphene SQL table statement for a database table

graphene serve # Start the local dev server (foreground)
graphene serve --bg # Start the local dev server in the background
graphene stop # Stop the background dev server
```

## Weekly evals and session reviews (Cloud)

Publish eval definitions under `evals/` in your project. Each `.yaml` or `.yml` file contains one question and rubric; its full project-relative path identifies the eval. Nested folders work.

```yaml
# evals/departure-delays.yaml
question: Which airlines have the worst departure delays?
rubric: Rank carriers by average departure delay and show a bar chart of the ten worst carriers.
```

Every Monday at **06:00 UTC**, Cloud discovers eval YAML in the repository’s **current published Postgres files**. Regular GitHub sync publishes `.yaml`/`.yml` under `evals/`, relative to the configured project directory. Unchanged files run again the following week; repositories without a published revision or eval files are skipped. Each file executes independently; definition/execution failures appear with DBOS errors in history. Discovery failures are logged as failed weekly workflows. There is no manual launch or historical catch-up. Evals use normal agent sessions, instructions, tools and query models. Grading files are hidden from agent tools/instructions and report navigation.

**Sync during execution is accepted.** Definitions, instructions and models are not frozen: each read uses the current published files, including on recovery. The saved SHA is only the publication observed when scheduling, not proof of which contents an execution used.

Cloud admins can inspect read-only history in Settings → Eval runs or read JSON from the configured Cloud project:

```bash
graphene evals                         # Recent per-file executions, by creation time
graphene evals <eval-id>               # Grade, DBOS status/error and session evidence
graphene reviews                       # Latest completed reviews, including clean reviews
graphene reviews <session-id>          # Findings and reviewed transcript
graphene evals --days 30               # Per-file executions from the last 30 days
graphene reviews --days 30             # Completed reviews from the last 30 days
```

Each eval ID identifies **one repository / UTC scheduled day / eval-file path**, not an entire suite. JSON rows include `day`, `file`, informational `sha`, `sessionId`, nullable boolean `grade`, `reason`, and DBOS `status`/`error`. The UI shows repository/day pass rates, then the group’s eval table, then individual details. Individual details show today’s published rubric (with an explanatory info tooltip); the question stays in the transcript: **historical rubric views can change when files change**, or fail if the file was removed. Saved grades/transcripts remain available. No execution or inspection reads GitHub directly; the offline example includes ordinary YAML in Postgres.

Result lists default to the last seven days. Use `--days N` with a positive integer to change the window (`createdAt >= now - N days`), using eval/review creation time, not session activity or scheduled day. Direct detail IDs remain repository-scoped with no age limit; `--days` is ignored when an ID is provided. The existing review UI is a separate all-history session inventory; its “all” view still includes unreviewed sessions. Commands do not use Git, launch models or poll. Use the evidence to propose changes to models, instructions or eval definitions; the commands do not apply changes.

Access requires an admin login or admin `GRAPHENE_TOKEN`. Token roles are snapshots at issuance; older tokens without `isAdmin` must be reminted after an admin login.
