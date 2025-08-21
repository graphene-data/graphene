Graphene is new data stack that allows you to define everything in code, from modeling to dashboards.

Why code? Because AI coding agents are really good, and putting your entire data stack in a single repo makes it easy to analyze and change. This repo provides all the pieces that make Graphene work.

At a high level, we provide a superset of sql that allows for defining semantic models and measures, as well some query QoL improvements like `tableA.tableB.someColumn` automatically expanding into the correct join. Users can also create markdown files that turn in to beautiful web-based reports and dashboards that can include custom queries and charts.

# Repo structure
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /vscode - an extension that provides syntax highlighting and diagnostics on queries.
* /examples - a series of example datasets


# Tech stack
Graphene is mostly written in typescript. We parse Graphene SQL with Lezer, then translate it to an IR used my Malloy, which we then use to render the final, dialect-specfic SQL.

We use Evidence to to turn markdown files into interactive data pages. Under the hood, Evidence uses vite, svelte, and mdsevx to make this work.

# Testing
Most directories have test files you can run to ensure they work correctly. You can run them via `npm test -w <workspace>`, where workspace is one of 'cli', 'lang', etc.

Often, it's helpful to know how Malloy would compile given to to it's IR. `node scripts/howDoesMalloy.ts` will print out the final SQL, along with the IR. There's some example code within `howDoesMalloy` that gets run, and it's easiest to just modify this to your needs before running.

# Code style
In Graphene, our primary stylistic goal is "high-level readability". We want easily skim a file or function and get a sense of what it does. We care less about the tactical details of how it accomplishes that.

There are a few concrete guidlines we usually follow in service of this:

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
It's easier to read the happy-path. Avoid input checking or error handling unless there's a good way to recover. It's mostly fine to just let errors bubble up.
