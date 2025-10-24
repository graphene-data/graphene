# How to develop in Graphene

Graphene is a framework for building semantic layers and data visualizations in code. Graphene projects are comprised of:
- .gsql files that define semantics-enriched tables (aka semantic models)
- .md files that define data apps (dashboards)

Graphene also has a CLI that lets you check syntax, run queries, serve data apps, and more.

## Graphene SQL (GSQL)

### Tables
Tables have to be declared first before they can be queried. A table in Graphene has the added concept of _semantics_. Semantics are stored expressions and join relationships associated with a table that `select` queries can leverage. This allows query logic to be centralized, reusable, and more easily governed.

Here's an example:

```gsql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  amount FLOAT, -- paid by customer #units=usd
  cost FLOAT, -- cost of materials #units=usd

  join_one users on user_id = users.id,

  sum(amount) as revenue,
  sum(amount - cost) as profit,
  profit / revenue as profit_margin
);

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,

  join_many orders on id = orders.user_id
);
```

Syntax notes
- `table foo (...)` defines a Graphene table based on the database table `foo`. 
- The allowed join types are `join_one` and `join_many`. All joins are left outer joins. There is no inner, right, or cross join.
- `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
- `join_many` is used if there are many rows in the **right** table for each row in the **left** table.
- As with normal SQL, joins can be optionally aliased with `as`. This is necessary when the same table can join to another in multiple ways, eg. `join_one users as owner on user_id = owner.id` and `join_one users as viewer on user_id = viewer.id`.
- Comments in tables can provide descriptions as well as metadata (denoted by `#` inside the comment).

Best practices
- For a given table, only model joins that are directly on that table. Graphene will automatically traverse multi-hop joins when it compiles the collective table space.
- A join between two tables should be modeled in both the respective `table` statements. This may seem redundant but it offers more flexibility for queries to choose which table to set in the `from` (remember that direction matters since all joins are left joins).

### Queries
Graphene tables can be queried using `select` statements. Here are some example queries on the tables above:

```
-- top 10 customers by profit
from orders select
  users.name, -- notice how we can access the joined table without a join here
  profit -- this expands into the stored expression defined in the table
order by 2 desc
limit 10
```

```
-- average age of customers over time
select
  month(date),
  average(users.age), -- in normal SQL this would fan-out in the join; in Graphene it smartly de-duplicates the fan-out when computing aggregates
from orders 
```

Syntax notes
- Columns and stored expressions from joined tables can be accessed with the dot operator, eg. `users.age` in the example above. Multiple join hops can be traversed with multiple dots, eg. `users.countries.country_code`.
- `join_one` and `join_many` work here, too. This is useful if the join you need has not been modeled already.
- The `from`, `select`, `group by`, and `where` clauses can be written in any order.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` is valid.
- `group by all` is implied if aggregate and scalar expressions are both present in the `select`. It can be omitted and the query will still effectively execute the `group by all`.
- `count` is a reserved word. Do not alias your columns as `count`.


## Graphene viz (.md)
Graphene data apps are written in Markdown with components. Markdown files can contain named GSQL queries in code fences that components can then refer to. Those queries can use any tables defined in .gsql files.

````markdown
  # Order analysis
  Looking at our order breakdowns.

  ```sql orders_by_month
    from orders select date_trunc(created_at, month) as month, count(*) as num_orders, profit
  ```

  <Row>
    <LineChart data="orders_by_month" x="month" y="num_orders" title="Orders by Month" />
    <LineChart data="orders" x="date_trunc(created_at, month)" y="profit" title="Profit by Month, USD" />
  </Row>
````

Note that components can also directly refer to Graphene tables in their `data` property; it is not always necessary to prepare data in a code-fenced query. Properties that take column references can also take whole expressions, as shown in the second line chart from the example above.

Best practices
- If you have multiple time series charts, align their x-axes to have the same range and granularity.
- Use the same color for a given metric if it is used in multiple charts.

### Components
The following components are available:
- [BarChart](./data_apps/components/charts/bar-chart.md)
- [LineChart](./data_apps/components/charts/line-chart.md)
- [AreaChart](./data_apps/components/charts/area-chart.md)
- PieChart - takes a `category` and `value` attribute
- Row - evenly distributes its children in a row
- [DateRange](./data_apps/components/inputs/date-range.md)
- [BigValue](./data_apps/components/data/big-value.md)
- [Table](./data_apps/components/data/table.md)
- [TextInput](./data_apps/components/inputs/text-input.md)

## Using the Graphene CLI
These are the available commands:
- `npm run cli check` - Checks the syntax for the entire Graphene project.
- `npm run cli compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run cli run "<GSQL>"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run cli serve` - Starts (or restarts) the dev server, which allows the user to view their Graphene app on localhost.
- `npm run cli view <mdPath>` - Captures a screenshot of a given .md file, along with any errors encountered.

## AGENT INSTRUCTIONS
Follow these guidelines when working in a Graphene project.
- Before writing any GSQL queries, run them in the CLI first to make sure that the results make sense.
- Do not redefine joins or expressions in a GSQL query that already exist as semantics in a table. For example, if profit has already been defined as the stored expression `sum(revenue - cost) as profit` on the table `orders`, you can simply refer to it in a downstream query as `select profit from orders`.
- Because all joins in Graphene are left outer joins, be mindful about your `from` table selection.
- Do not try to search the web for Graphene-specific info; you will not find anything. All the documentation is in /docs.
- If you write to a .gsql file, run a syntax check with `npm run cli check`.
- If you write to a .md file:
  - First read ALL the linked component docs listed in [Components](#components) above.
  - After writing code, run a syntax check with `npm run cli check`.
  - Once there are no syntax errors, do a visual check by running `npm run cli view <mdPath>` and looking at the .png it generates. 