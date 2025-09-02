# Working with Graphene projects

Graphene projects are comprised of:
- .gsql files, where data models are defined
- .md files, that define data apps built on those data models

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
  measure revenue sum(amount),
  measure profit sum(amount - cost),
  measure profit_margin profit / revenue
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
  average(users.age) -- in normal SQL this would be incorrect due to the join; in graphene it works
from orders
group by 1
order by 1 asc
;
```

GSQL also supports the following features:
- `FROM` before `SELECT` (optional)
- Ability to filter on aggregates in the `WHERE` clause (`HAVING` still works too)
- Implied `GROUP BY` in the presence of aggregates, without needing an explicit `GROUP BY` clause


## Visualizing Data with Markdown

Graphene currently uses the Evidence markdown spec and component library for building data applications. However, Graphene does not use Evidence's CLI nor does it support anything other than GSQL. Graphene projects do not support .sql files.

Consult the Evidence documentation for markdown syntax guidance.

## Using the Graphene CLI

These are the available commands:
- `npm run cli check` - Checks the syntax for the entire Graphene project.
- `npm run cli compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run cli run "GSQL"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run cli serve` - Starts the dev server, which allows the user to view the Evidence app at localhost:3000 in their browser.


