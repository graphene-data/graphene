Graphene is new data stack that allows you to define everything in code, from modeling to dashboards.

Graphene allows you define dashboards, analyses, and interactive data apps in Markdown, and define semantic models and queries in a superset of sql we call Graphene SQL (gsql).
If you need to know more about Graphene's features, read @docs/graphene.md.

# Repo structure
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /examples - a series of example datasets and graphene code. `flights` is the go-to as it's local, fast, and doesn't require auth.
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
* /vscode - an extension that provides syntax highlighting and diagnostics on queries.

# Tech stack
Graphene is mostly written in typescript. We parse Graphene SQL with Lezer, then translate it to Malloy's IR, and use Malloy to render dialect-specific SQL.

For local development, the cli starts a vite server to host your md files and execute queries. The UI is mostly written in Svelte 4, and markdown files are translated to svelte components with `mdsvex`. Our charting components are from Evidence, which itself wraps echarts.

# Process
NEVER run `pnpm install` or `pnpm add`. If the env seems broken, summarize what seems wrong and let the user fix it. If you need to add dependencies, explain what you'd like to add and why.
Write a draft `.gitcommit` for changes you make. As we iterate on a change, keep this draft up to date.

# Bugfixes
Explain clearly what the underlying issue is, and how your fix addresses it. Ensure there's a test covering the issue, and that the tests pass. Write a draft to `.gitcommit` that explains the observed behaviour and the underlying fix. Your summary should include any other solutions you considered, and why you picked the one you did. This draft should be clear but succinct.

# Testing
Most directories have test files you can run to ensure they work correctly. You can run them via `pnpm test` in that directory.
UI tests take screenshots of various states, so you can review `tests/snapshots` and `tests/results` to look at UI states. This is useful even if the test passes to just see what a give state looks like.
Use `howDoesMalloy` to view the Malloy IR used for a given Malloy query.
When testing AI features, always use a mock rather than hitting an API.
Never ask for permission to run tests or update screenshots. Just do it.

# Code style
In Graphene, our primary stylistic goal is "high-level readability". We want to easily skim a file or function and get a sense of what it does. We care less about the tactical details of how it accomplishes that. There are a few concrete guidlines we usually follow in service of this:

### Start simple
Your first pass at an implementation should usually be the easiest thing that solves the problem in front of you. We can always add complexity later as needed.

### Avoid indirection
When it's easy to inline a bit of code, prefer that over making tons of small functions. This is also true for files, avoid creating tons of files/folders that will have very little in them.

### Vertically compact
It's easier to read 2-3 wide lines than 10 narrow ones.

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

### Avoid indentation
Where possible, prefer early returns and avoid excessive indentation, which makes the flow harder to follow.

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

### Only use meaningful comments
Most functions should have a comment describing what they do. For longer methods it's a good idea to add some high-level comments to help readers understand the flow.

Comments are also great when there is code whose purpose isn't obvious from first reading it.
DO NOT add silly little comments that say something the code obviously says. This is bad:
> // process element
> processEleme(e)

### Use guards and try/catch sparingly
It's easier to read the happy-path. Avoid input checking or error handling unless there's a good way to recover. It's mostly fine to just let errors bubble up. In node, throwing an error already exits the process, so no need to catch just to process.exit.
