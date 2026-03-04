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
graphene run path/to/page.md -q query_name # Run a named query/table from the markdown context and print results
```

`-q/--query` can target anything usable in a chart `data` prop (for example, a gsql table or a named code-fenced query in the markdown file).

Invoke via your project's package manager (e.g. `pnpm graphene check`, `npm exec graphene run`).

Other commands:

```bash
graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL
```
