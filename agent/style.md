In Graphene, our primary stylistic goal is "high-level readability". We want easily skim a file or function and get a sense of what it does. We care less about the tactical details of how it accomplishes that.

There are a few concrete guidlines we usually follow in service of this:

# Start simple
Your first pass at an implementation should usually be the easiest thing that solves the problem in front of you. We can always add complexity later as needed.

# Avoid indirection
When it's easy to inline a bit of code, prefer that over making tons of small functions.

# Vertically compact
It's better to have 2-3 wide lines than 10 narrow ones.

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

# Avoid indentation
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

# Only use meaningful comments
Comments are best when they describe a function, or a section of 2-4 code lines whose purpose might be less obvious from the code.

DO NOT add silly little comments that say something the code obviously says. This is bad:
> // process element
> processEleme(e)

# Use guards and try/catch sparingly
It's easier to read the happy-path. Avoid input checking or error handling unless there's a good way to recover. It's mostly fine to just let errors bubble up.
