## CLI

When using Graphene from the CLI, the main command would be:

`npm exec graphene check`

Use the appropriate package manager if this project doesn't use npm. `check` takes several options

```bash
npm exec graphene check # Syntax check entire project
npm exec graphene check [mdPath] # Check specific markdown file, and take a screenshot
npm exec graphene check [mdPath] -c [chartTitle] # Check and get a screenshot for one specific chart
```

`npm exec graphene run "<sql>"` can be used to run sql directly, without creating a md file.
`npm exec graphene compile "<sql>"` shows the compiled, dialect-specific SQL.

### Best Practices

Start simple - Get basic query working, then add complexity.
Use check often - Catches syntax errors and shows visual output.
Leverage models - Use modeled joins and stored expressions rather than raw SQL.
