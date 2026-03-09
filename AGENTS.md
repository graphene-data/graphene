Graphene is data framework that allows you to define everything in code.

Dashboards and reports can be built in mdx with components like <BarChart>. Queries and semantic models are written in a language we call gsql, which is mostly like sql with some special features like symmetric aggregates, synthetic columns for code reuse, and automatic join traversal. If you need to know more about Graphene's features, read @docs/base.md.

# Repo structure

- /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
- /examples - a series of example datasets and graphene code. `flights` is the go-to as it's local, fast, and doesn't require auth.
- /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
- /ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
- /vscode - an extension that provides syntax highlighting and diagnostics on queries.

# Graphene CLI commands

Graphene provides a CLI that users (and agents) use to do data work.
You can run any of these cli commands within all of our examples. It's important that your cwd is an example folder (like `/examples/flights`).

`pnpm graphene check <mdFile>` - Checks the project for syntax and analysis errors in gsql files. `mdFile` is optional, but if provided it will load that page in a browser, check for runtime errors, and write a screenshot out to a file.
`pnpm graphene serve --bg` - Starts (or restarts) the Graphene dev server. You should rarely need to call this, the server is started automatically by `check`, and because it's a vite server most files will hot-reload. You only need this if you've changed something about the server's config. Always run it with the --bg option.
`pnpm graphene run <gsql>` - Runs a given gsql query against the configured database.
`pnpm graphene compile <gsql>` - Compiles gsql to the underlying database sql and prints it out.
`pnpm graphene schema <dataset_or_table>` - Prints out tables within a database/schema, or the columns of a given table.

# Tech stack

Graphene is mostly written in typescript. We parse gsql with Lezer, analyze it for errors, and render to dialect-specific sql.

For local development, the cli starts a vite server to host your md files and execute queries. The UI is mostly written in Svelte 5, and markdown files are translated to svelte components with `mdsvex`. Our charting components are from Evidence, which itself wraps echarts.

# Testing

`pnpm lint` to run both eslint and tsc
`pnpm test` to run all tests. `pnpm test [cli|lang|ui]` to run all the tests for a section of the codebase. Uses vitest v4 under the hood, if you want to pass other options.
For any test with UI, capture screenshots. They are always written to tests/snapshots, and it's prudent to view them after large changes to ensure the UI still looks right. When a screenshot is sufficient to verify visual behavior (colors, layout, rendering), prefer it over programmatic assertions — it's simpler and easier to maintain.
When testing AI features, always use a mock rather than hitting an API.
Never increase timeouts in a test. If a test is too slow, lets discuss why and how to speed it up.

# Code style

Our primary stylistic goal is "high-level readability". We want to easily skim a file or function and get a sense of what it does. We care less about the tactical details of how individual lines of code work. There are a few concrete guidlines we usually follow in service of this:

### Start simple

Your first pass at an implementation should usually be the easiest thing that solves the problem in front of you. We can always add complexity later as needed.

### Avoid indirection

When it's easy to inline a bit of code, prefer that over making tons of small functions. This is also true for files, avoid creating tons of files/folders that will have very little in them.

### Vertically compact

It's easier to read 2-3 wide lines than 10 narrow ones. When in doubt, try and follow the formatting of surrounding code.

```
function good () {
  let ast = parseQuery(rawSql, {dialect: 'bigquery', functions: {...bqFunctions, hll}})
  let rows = executeQuery(ast).filter(x => !!x).map(rawRow => new RowStruct(rawRow, {engine: 'bigquery'}))
  return {rows}
}

function bad () {
  let ast = parseQuery(
    rawSql,
    {
      dialect: 'bigquery',
      functions: {
        ...bqFunctions,
        hll
    }
  })
  let rows = executeQuery(ast)
    .filter(x => {
      return !!x
    })
    .map(rawRow => {
      return new RowStruct(
        rawRow,
        {
          engine: 'bigquery'
        }
      )
    })
  return {
    rows
  }
}
```

### Avoid indentation

Where possible, prefer early returns and avoid excessive indentation, which makes the flow harder to follow.

```
function good (elems) {
  if (elems.length == 0) return []
  for (let e of elems) {
    if (e.type != 'rightType') continue
    processElem(e)
  }
}

function bad () {
  if (elems.length > 0) {
    for (let e of elems) {
      if (e.type == 'rightType') {
        processElem(e)
      }
    }
  }
}
```

### Only use meaningful comments

Most functions should have a comment describing what they do.
Long methods can ideally be organized into logical sections, and it's often worth a comment to help us understand the overall flow.
Comments are also key when there is code whose purpose isn't obvious from first reading it.
Avoid comments that say something obvious from reading the code. For example: `processElem(e) // process element`

### Avoid try/catch and excessive guards 99% of the time

Lots of try/catch or null-checking code makes the overall flow harder to read.
We almost never add try/catch unless we can do something meaningful. Logging the error doesn't count as meaninful, that would happen anyway as it bubbled up.
Similarly, you don't need to check for nulls in cases where you never expect a value to be null. It's fine for unexpected nulls to implicitly throw errors.
