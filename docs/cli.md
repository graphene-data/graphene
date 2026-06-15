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
graphene run 'from flights where carrier = $carrier select count() as total' --input carrier=AA # Provide parameter input values
graphene run - # Read GSQL from stdin and print results
graphene run path/to/page.md # Open the page in your system browser and save a full-page screenshot
graphene run path/to/page.md --headless # Run the page in a headless browser and save a full-page screenshot
graphene run path/to/page.md --port 4170 # Use a specific local dev server port
graphene install-browser # Install the browser used by `graphene run --headless`
graphene run path/to/page.md --input carrier=AA # Run the page with input values, overriding page defaults

# Running a markdown page starts the local dev server in a persistent background process if one is not already running.
# The command prints the live page URL, e.g. http://localhost:4000/path/to/page, and the server keeps running for hot reloads.
# After iterating until the screenshot looks acceptable, agents can link users directly to that localhost URL.

# `-c/--chart` can target a chart or table title, or the component ID printed by `graphene list`.
graphene run path/to/page.md -c "Chart Title" # Run the page and screenshot one chart/table by title
graphene run path/to/page.md -c "Chart Title" --format csv # Export the data backing one chart/table as CSV
graphene run path/to/page.md -c 'BarChart (data="query_name" x="category" y="total")' # Run the page and screenshot one chart/table by component ID

# `-q/--query` can target anything usable in a chart `data` prop (for example, a gsql table or a named code-fenced query in the markdown file).
graphene run path/to/page.md -q query_name # Run a named query/table from the markdown context and print results
graphene run path/to/page.md -q query_name --format csv # Run a named query/table and print results as CSV
graphene run path/to/page.md -q query_name --input carrier=AA # Run a parameterized named query/table

# `--input` values are strings. Repeat the flag to pass multiple values for one input.
graphene run path/to/page.md --input carrier=AA --input carrier=DL

graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL

# `schema` is for implementation/migration purposes and is NOT for exploring GSQL models
graphene schema # List datasets/schemas in the connected database
graphene schema my_dataset # List schemas (or tables) in a dataset
graphene schema my_dataset.table # Print the GSQL table statement for a database table

graphene serve # Start the local dev server (foreground)
graphene serve --bg # Start the local dev server in the background
graphene serve --bg --port 4170 # Start the background dev server on a specific port
graphene stop # Stop the background dev server
```
