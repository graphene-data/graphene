Graphene is new data stack that allows you to define everything in code, from modeling to dashboards.

Graphene allows you define dashboards, analyses, and interactive data apps in Markdown, and define semantic models and queries in a superset of sql we call Graphene SQL (gsql).
If you need to know more about Graphene's features, read @docs/graphene.md.

# Repo structure
* /agent - a wrapper around claude-code used for Graphene's "explore" ux
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /examples - a series of example datasets and graphene code. `flights` is the go-to as it's local, fast, and doesn't require auth.
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
* /vscode - an extension that provides syntax highlighting and diagnostics on queries.

# Tech stack
Graphene is mostly written in typescript. We parse Graphene SQL with Lezer, then translate it to Malloy's IR, and use Malloy to render dialect-specific SQL.

For local development, the cli starts a vite server to host your md files and execute queries. The UI is mostly written in Svelte 4, and markdown files are translated to svelte components with `mdsvex`. Our charting components are from Evidence, which itself wraps echarts.

# Process
* Never install dependencies. Always ask the user to install them.
* Don't grep for files or read code in node_modules. If it seems necessary, stop with a clear explanation of what you need and why.
* To review images or screenshots, use `node scripts/reviewImage.ts "<prompt>" --<label>=<image-path>`. The prompt tells it what you'd like it to look for in the images. You can provide multiple labeled images (for example, to compare a baseline screenshot to a version with changes).

# Testing
Most directories have test files you can run to ensure they work correctly. You can run them via `pnpm test` in that directory.

For UI development, use tests and screenshots to ensure things work as expected. When you run a single test (like `pnpm test -g "bar char"`) we automatically capture a screenshot and print out the path. Use `reviewImage` and tell it what you're expecting to see and what it should check for.

While tests are preferred, you can also always test UI by starting up the graphene server and loading a page via the Playwright MCP. Both the `flights` and `ecomm` examples are useful for testing things. Always use the Playwright mcp for viewing webpages.

Often, it's helpful to know how Malloy would compile given to to it's IR. `node scripts/howDoesMalloy.ts` will print out the final SQL, along with the IR. There's some example code within `howDoesMalloy` that gets run, and it's easiest to just modify this to your needs before running.

When testing AI features, always use a mock rather than hitting an API. On the explore page, you can use "mock" as the prompt to get simulated messages.

# Code style
In Graphene, our primary stylistic goal is "high-level readability". We want to easily skim a file or function and get a sense of what it does. We care less about the tactical details of how it accomplishes that. There are a few concrete guidlines we usually follow in service of this:

### Start simple
Your first pass at an implementation should usually be the easiest thing that solves the problem in front of you. We can always add complexity later as needed.

### Avoid indirection
When it's easy to inline a bit of code, prefer that over making tons of small functions.

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
