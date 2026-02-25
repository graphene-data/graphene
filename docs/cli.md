## CLI

The main command in Graphene is `check`. It takes several options:

```bash
npm exec graphene check # Check syntax for entire project
npm exec graphene check [mdPath] # Check specific markdown file, run queries, and take a screenshot
npm exec graphene check [mdPath] -c [chartTitle] # Check, run, and get a screenshot for one specific chart
```

Use the appropriate package manager if this project doesn't use npm.

Other commands:

```bash
npm exec graphene run "[GSQL]" # Run GSQL directly, without creating a .md file
npm exec graphene compile "[GSQL]" # Show the compiled, dialect-specific SQL
```
