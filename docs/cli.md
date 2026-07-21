# CLI

Invoke the CLI via your project's package manager (e.g. `pnpm graphene check`, `npm exec graphene run`).

```bash
# `check` is a linter and mainly used when editing .gsql files
graphene check # Check across all .gsql files in the project
graphene check path/to/file.gsql # Check for one specific gsql file
graphene check path/to/page.md # Check for one specific markdown file

# `run` is the primary command for iterating on queries and pages
graphene run "from flights select count() as total" # Run inline GSQL and print results
graphene run "from flights select count() as total" --format csv # Print query results as CSV
graphene run path/to/page.md # Open the page in your system browser and save a full-page screenshot
graphene run path/to/page.md --param carrier=AA # Run the page with param values, overriding page defaults
graphene run - # Read GSQL from stdin and print results

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

graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL. Does not run a query.

# `schema` is for implementation/migration purposes and is NOT for exploring GSQL models
graphene schema # List datasets/schemas in the connected database
graphene schema my_dataset # List schemas (or tables) in a dataset
graphene schema my_dataset.table # Print the GSQL table statement for a database table

graphene serve # Start the local dev server (foreground)
graphene serve --bg # Start the local dev server in the background
graphene stop # Stop the background dev server
```
