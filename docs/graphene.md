# Working with Graphene projects

Graphene projects are comprised of:
- .gsql files, where data models are defined
- .md files, that define data apps (dashboards) built on those data models

Graphene also has a CLI that lets you check syntax, run queries, and serve data apps.

## Querying and Modeling with GSQL

GSQL is like regular SQL but has been extended in the following ways:
- You can define semantic models by storing bits of named, reusable SQL logic inside of `table` statements. 
- The allowed joins types are `join_one` and `join_many`. All joins are left outer joins. There is no inner, right, or cross join.
 - `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
 - `join_many` is used if there are many rows in the **right** table for each row in the **left** table.

Here is an example model in GSQL:

```
table orders (
  id BIGINT,
  user_id BIGINT,
  created_at DATETIME,
  amount FLOAT,
  cost FLOAT,

  join_one users on user_id = users.id,
  sum(amount) as revenue,
  sum(amount - cost) as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT,
  name VARCHAR,
  email VARCHAR,
  age INTEGER
)
```

You can then query that model with SELECT queries:

```
-- top 10 customers by profit
select
  users.name, -- notice how we can access the joined table without a join here
  profit -- this expands into the aggregate expression defined in the model
from orders
group by 1
order by 2 desc
;

-- average age of customers over time
select 
  month(date),
  average(users.age) -- in normal SQL this would be incorrect due to the fan-out in the join; in Graphene it smartly de-duplicates the fan-out when computing aggregates
from orders
group by 1
order by 1 asc
;
```

GSQL also supports the following features:
- `FROM` before `SELECT` (optional)
- Ability to filter on aggregates in the `WHERE` clause (`HAVING` still works too)
- `GROUP BY` is optional; it is implicitly applied if you have any aggregations in the query


## Visualizing Data with Markdown

Graphene data apps are written in markdown, with a couple notable extensions:
- Create visualizations, widgets, and navigational UI components with simple HTML blocks
- Create GSQL queries that your components can reference in code fences

### Components

Graphene has a built in component library to create charts and other visual elements. The full documentation is [here](./data_apps/components).

```markdown
<LineChart 
    data = {orders_by_month}    
    y = sales_usd 
    title = 'Sales by Month, USD' 
/>
```

### GSQL in Markdown

Code fences in Graphene markdown files run inline GSQL queries and return data.

````markdown
```sql orders_by_month
select
    date_trunc('month', order_datetime) as order_month,
    count(*) as number_of_orders,
    sum(sales) as sales_usd
from needful_things.orders
group by 1, order by 1 desc
```
````

Notice that GSQL queries must be **named** (eg. `orders_by_month` above) in order to be referenceable by other components on the page.

## Using the Graphene CLI

These are the available commands:
- `npm run cli check` - Checks the syntax for the entire Graphene project.
- `npm run cli compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run cli run "GSQL"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run cli serve` - Starts the dev server, which allows the user to view the Evidence app at localhost:3000 in their browser.


