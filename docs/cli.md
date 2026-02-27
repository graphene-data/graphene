# CLI

The main command in Graphene is `check`. It takes several options:

```bash
graphene check # Check syntax for entire project
graphene check [mdPath] # Check specific markdown file, run queries, and take a screenshot
graphene check [mdPath] -c [chartTitle] # Check, run, and get a screenshot for one specific chart
```

Invoke via your project's package manager (e.g. `pnpm graphene check`, `npm exec graphene check`).

Other commands:

```bash
graphene run "[GSQL]" # Run GSQL directly, without creating a .md file
graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL
```
