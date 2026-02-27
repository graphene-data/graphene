This is the monorepo for Graphene, a company and framework that enables data analytics as code.

Graphene allows users to create interactive reports and dashboards with Markdown, as well as semantic models in a variant of SQL that we call gsql. You can read core/docs/graphene.md as needed for more details on everything gsql and md can do, but here's a very brief example:

---- models.gsql example file
table carriers (
  code VARCHAR
  name VARCHAR
)

table flights (
  carrier VARCHAR -- Airline carrier code (e.g., 'AA', 'UA', 'DL')
  dep_delay BIGINT -- Departure delay in minutes (negative = early, positive = late)
  join one carriers on carrier = carriers.code
  
  refund_eligible: dep_delay > 180
)
--- end of models.gsql example file

--- report.md example file
```gsql most_delayed
from flights select carrier.name, sum(dep_delay) as total_delay where refund_eligible limit 10
```
<BarChart data=most_delayed x=carrier_name y=total_delay />
--- end of report.md example file

## Repo overview
/core - Graphene's open-source core library. Lives in a separate repo and is submoduled here
/core/cli - Graphene's cli that can check and run queries, as well as run a local dev server for viewing dashboards.
/core/examples - a series of example datasets and graphene code. `flights` is the go-to as it's local, fast, and doesn't require auth.
/core/lang - language server that can parse gsql, generate diagnostics, and transform to dialect-specific SQL.
/core/ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
/core/vscode - an extension that provides syntax highlighting and diagnostics on queries.
/cloud - Graphene's optional, paid hosted service.
/cloud/terraform - hosted infrastructure. Read the `infra` skill when working with this.

# Testing
Our tests are run with vitest. Use `pnpm test` in either cloud or core to run the tests for either.
You can run a single test with `pnpm test -t "part of test name"`
Lint+typecheck with `pnpm lint` in either cloud or core.
All UI tests should capture a screenshot. Don't add programmatic assertions around rendered html, the screenshot will cover that.

## Workflow
* `/core` is a submodule, so to do git operations there you'll want to `git -C core status`
* Always use `pnpm add` rather than editing package.json directly to ensure we get the latest version of new dependencies.
* We use node-24 which has type stripping by default, so you should never need `ts-node` or `tsx` to run things.
* Avoid running `graphene dev` to test things. You should be able to set up any scenario in our automated tests.
* Don't make infra changes directly via the `aws` cli. Make changes to the terraform config and deploy that.
* You're pair-programming with another senior engineer. If you notice that edits were made to a file you're working on, is was probably your partner. Don't undo those changes, try to follow their direction. If they don't make sense or seem wrong, pause and say so.
* For each change, add exactly one migration file in `cloud/migrations` (avoid shipping multi-file migration chains for one feature). Give the migrations useful names.

# Code style
Our primary stylistic goal is "high-level readability". We want to easily skim a file or function and get a sense of what it does. We care less about the tactical details of how individual lines of code work. There are a few concrete guidelines we usually follow in service of this:

### Start simple
Your first pass at an implementation should usually be the simplest thing that solves the problem in front of you. We can always add complexity later as needed.
If you need to add complexity to work around an issue, that's a great time for a comment to explain why the additional code is needed.
If you later realize the solution has grown too complex or convoluted, clean it up.
THIS IS THE GOLDEN RULE! Always be thinking if you can simplify the implementation. If you come across code that seems needlessly complex, offer to clean it up.

### Don't take shortcuts
If something isn't working, don't do a hacky thing just to get the tests to pass. Take the time to fully understand why some bit of code isn't working, and fix it properly. If the proper fix seems large or not backwards-compatible, you can stop to discuss it.

### Avoid indirection
When it's easy to inline a bit of code, prefer that over making tons of small functions. This is also true for files, avoid creating tons of files/folders that will have very little in them.

### Vertically compact
It's easier to read 2-3 wide lines than 10 narrow ones. When in doubt, try and follow the formatting of surrounding code.
Where possible, prefer early returns and avoid excessive indentation, which makes the flow harder to follow.

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

### Only use meaningful comments
Most functions should have a comment describing what they do.
Long methods can ideally be organized into logical sections, and it's often worth a comment to help us understand the overall flow.
Comments are also key when there is code whose purpose isn't obvious from first reading it.
Avoid comments that say something obvious from reading the code. For example: `processElem(e) // process element`

### Avoid try/catch and excessive guards 99% of the time
Lots of try/catch or null-checking code makes the overall flow harder to read.
We almost never add try/catch unless we can do something meaningful. Logging the error doesn't count as meaningful, that would happen anyway as it bubbled up.
Similarly, you don't need to check for nulls in cases where you never expect a value to be null. It's fine for unexpected nulls to implicitly throw errors.
