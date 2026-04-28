# CLI

`graphene check` is a diagnostics command.

```bash
graphene check # Check diagnostics across all .gsql files in the project
graphene check path/to/file.gsql # Check diagnostics for one specific gsql file
graphene check path/to/page.md # Check diagnostics for one specific markdown file
```

`graphene run` supports both query execution and markdown page runs.

```bash
graphene run "from flights select count() as total" # Run inline GSQL and print results
graphene run - # Read GSQL from stdin and print results

graphene run path/to/page.md # Run the page and save a full-page screenshot
graphene run path/to/page.md -c "Chart Title" # Run the page and screenshot one chart by title
graphene run path/to/page.md -c 'Query (data="query_name" x="category" y="total")' # Run the page and screenshot one chart by queryId
graphene run path/to/page.md -q query_name # Run a named query/table from the markdown context and print results
```

`-c/--chart` can target either a chart title or the chart's `queryId`. For charts without title,s use `graphene list` to see the exact IDs for charts on a page.

`-q/--query` can target anything usable in a chart `data` prop (for example, a gsql table or a named code-fenced query in the markdown file).

`graphene list` prints the `queryId` for every chart query on a page.

Invoke via your project's package manager (e.g. `pnpm graphene check`, `npm exec graphene run`).

Other commands:

```bash
graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL
```
