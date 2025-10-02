Graphene is a framework for building semantic models and data visualizations in code.

# Graphene SQL (GSQL)
GSQL is like regular SQL but has been extended in the following ways:
- `table` statements define semantic models, including joins and computed columns. Where possible, prefer to use already-defined columns in queries.
- The allowed joins types are `join_one` and `join_many`. All joins are left outer joins. There is no inner, right, or cross join.
- `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
- `join_many` is used if there are many rows in the **right** table for each row in the **left** table.
- from/select/group by/where clauses can be written in any order.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` is valid.
- Comments on columns can provide descriptions as well as metadata

```gsql
table orders (
  id BIGINT primary_key
  user_id BIGINT
  created_at DATETIME
  amount FLOAT -- paid by customer #units=usd
  cost FLOAT -- cost of materials #units=usd

  join_one users on user_id = users.id

  sum(amount) as revenue
  sum(amount - cost) as profit
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key
  name VARCHAR
  email VARCHAR
  age INTEGER
)

-- top 10 customers by profit
from orders select
  users.name, -- notice how we can access the joined table without a join here
  profit -- this expands into the aggregate expression defined in the model
order by 2 desc
limit 10
;

-- average age of customers over time
from orders select
  month(date),
  average(users.age), -- in normal SQL this would fan-out in the join; in Graphene it smartly de-duplicates the fan-out when computing aggregates
;
```

# Graphene viz (.md)
Graphene data apps/dashboards/explorations are all written in markdown with components.
Markdown files can contain named gsql queries in code fences that components can then refer to.
Those queries can use any models defined in .gsql files. When possible, it's preferred to reuse computed columns already defined in an existing models.

````markdown
  # Order analysis
  Looking at our order breakdowns.

  ```gsql orders_by_month
    from orders select date_trunc(created_at, 'month') as month, count(*) as num, profit
  ```

  <Row>
    <LineChart data="orders_by_month" x="month" y="num" title="Orders by Month" />
    <LineChart data="orders_by_month" x="month" y="profit" title="Profit by Month, USD" />
  </Row>
````

## Components
Currently Graphene has the following components available for use.
- BarChart, LineChart, AreaChart
- PieChart - takes a `category` and `value` attribute
- Row - evenly distributes its children in a row

# Using the Graphene CLI
These are the available commands:
- `npm run cli check` - Checks the syntax for the entire Graphene project.
- `npm run cli compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run cli run "GSQL"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run cli serve` - Starts the dev server, which allows the user to view their Graphene app on localhost.
