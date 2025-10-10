# How to develop in Graphene

Graphene is a framework for building semantic models and data visualizations in code. Graphene projects are comprised of:
- .gsql files that define semantic models
- .md files that define data apps (dashboards)

Graphene also has a CLI that lets you check syntax, run queries, serve data apps, and more.

## Graphene SQL (GSQL)

### Semantic models
Graphene SQL (GSQL) is like regular SQL except it has the added concept of _semantic models_. A semantic model is a collection of stored expressions and join relationships associated with a table that `select` queries can leverage. This allows query logic to be centralized, reusable, and more easily governed.

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
  age INTEGER
);
```

Syntax notes:
- `table foo (...)` defines a semantic model on the database table `foo`. 
- The allowed join types are `join_one` and `join_many`. All joins are left outer joins. There is no inner, right, or cross join.
- `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
- `join_many` is used if there are many rows in the **right** table for each row in the **left** table.
- Comments in semantic models can provide descriptions as well as metadata.

### Queries
Semantic models can be queried using `select` statements. Here are some example queries on the models above:

```
-- top 10 customers by profit
from orders select
  users.name, -- notice how we can access the joined table without a join here
  profit -- this expands into the aggregate expression defined in the model
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

Syntax notes:
- Columns and stored expressions from joined semantic models can be accessed with the dot operator, eg. `users.age` in the example above. Multiple join hops can be traversed with multiple dots, eg. `users.countries.country_code`.
- `join_one` and `join_many` work here, too. This is useful if the join you need has not been modeled already.
- The `from`, `select`, `group by`, and `where` clauses can be written in any order.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` is valid.
- `group by all` is implied if aggregate and scalar expressions are both present in the `select`. It can be omitted and the query will still effectively execute the `group by all`.


## Graphene viz (.md)
Graphene data apps are written in Markdown with components. Markdown files can contain named GSQL queries in code fences that components can then refer to. Those queries can use any models defined in .gsql files. When possible, it's preferred to reuse stored expressions already defined in existing models.

````markdown
  # Order analysis
  Looking at our order breakdowns.

  ```gsql orders_by_month
    from orders select date_trunc(created_at, 'month') as month, count(*) as num, profit
  ```

  <Row>
    <LineChart data="orders_by_month" x="month" y="num" title="Orders by Month" />
    <LineChart data="orders" x="date_trunc(created_at, 'month')" y="profit" title="Profit by Month, USD" />
  </Row>
````

Note that components can also directly refer to semantic models in their `data` property; it is not always necessary to prepare data in a code-fenced query. Properties that take column references can also take whole expressions, as shown in the second line chart from the example above.

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
- `npm run cli run "GSQL"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run cli serve` - Starts (or restarts) the dev server, which allows the user to view their Graphene app on localhost.
- `npm run cli view <mdPath>` - Captures a screenshot of a given md file, along with any errors encountered.

## AGENT INSTRUCTIONS
Follow these guidelines when working in a Graphene project.
- Before writing any GSQL queries, run them in the CLI first to make sure that the results make sense.
- Do not redefine joins or expressions in a GSQL query that already exist in a semantic model. For example, if profit has already been defined as the stored expression `sum(revenue - cost) as profit` on the table `orders`, you can simply use it in a downstream query as `select profit from orders`.
- After writing an .md file, run a syntax check with `npm run cli check`. 