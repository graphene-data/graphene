# How to develop in Graphene

Graphene is a framework for data analysis, semantic modeling, and data visualization in code. Graphene projects are comprised of:
- .gsql files that define semantics-enriched tables (aka semantic models)
- .md files that define data apps (aka dashboards)

Graphene also has a CLI that lets you check syntax, run queries, serve data apps, and more.

## Graphene SQL (GSQL)

GSQL is comprised of `table` statements that declare tables and `select` statements that query them.

### `table` statements

`table` statements manifest tables that already exist in your database. Here's an example of two tables, `orders` and `users`, in GSQL.

```sql
table orders (

  /* Base columns */

  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  /* Join relationships */

  join_one users on user_id = users.id,

  /* Scalar expressions */

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  /* Agg expressions */

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,
  country_code VARCHAR,

  join_many orders on id = orders.user_id
)
```

We can break down a table statement into three parts: [base columns](#base-columns-required), [join relationships](#join-relationships), and [stored expressions](#stored-expressions) (aka dimensions and measures).

#### Base columns (required)

The base column set is simply a reflection of the underlying database table's schema. Similar to `create table` statements in regular SQL DDL, you list each column's name and data type. One column must be designated as the primary key.

#### Join relationships

Join relationships in a `table` statement declare joins that can be used when querying them. This makes query writing easier and more foolproof. See [Using join relationships in queries](#using-join-relationships-in-queries) below for how to use modeled joins in queries.

The other main difference about joins in GSQL vs. regular SQL is that you have to explain if there are many rows in the left table for each row in the right table, or vice versa. This additional bit of information allows Graphene to prevent incorrect aggregation as a result of row duplication (aka fan-out) through joins. See [Safe aggregation in fan-outs](#safe-aggregation-in-fan-outs) for more details.

This information is provided with the two supported join types, `join_one` and `join_many`:
- `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
- `join_many` is used if there are many rows in the **right** table for each row in the **left** table.

In the example above with `orders` and `users`, the joins confirm that there are many orders per user, and only one user per order.

Note that all joins in GSQL are left outer joins. There is no inner, right, or cross join.

##### Multiple join relationships between the same two tables

Sometimes there are multiple valid ways to join two tables together. You can model this in Graphene by aliasing the various joins with `as`, just as you would in normal SQL. For example:

```sql
table projects (
  ...
  owner_id BIGINT,
  viewer_id BIGINT,

  join_one users as project_owner on owner_id = project_owner.id,
  join_one users as project_viewer on viewer_id = project_viewer.id
)

table users (
  ...
  id BIGINT,

  join_many projects as projects_as_owner on id = projects_as_owner.owner_id,
  join_many projects as projects_as_viewer on id = projects_as_viewer.viewer_id
)
```

##### Best practices for modeling join relationships

- For a given `table` statement, only model joins that are directly on that table. Multi-hop join paths do not need to be written explicitly in order for queries to traverse them.
- A join between two tables should be modeled in both the respective `table` statements. This may seem redundant but it offers more flexibility for queries to choose which table to set in the `from` (remember that direction matters in queries since all joins are left joins).

#### Stored expressions

**Stored expressions** are GSQL expressions (ie. any arbitrary combination of functions, operators, and column references) that you want to make reusable to queries. Stored expressions are great for canonizing metrics, segments, and other important business definitions.

A stored expression must be given a name via `as`. It can then be referenced by name in queries that use the parent table. See [Using stored expressions in queries](#using-stored-expressions-in-queries) below for how to use stored expressions in queries.

Like expressions in regular SQL, expressions in GSQL are either scalar or aggregative. In BI parlance, these would be called dimensions and measures, respectively.

Expressions can refer to other expressions, as shown below.

```sql
table orders (
  ...

  /* Scalar expressions */

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  /* Agg expressions */

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit, -- even though there are no agg functions here, this is still aggregative as it references other aggregative expressions
  profit / revenue as profit_margin
)
```


### `select` statements

`select` is how you write queries in Graphene SQL. It behaves similarly to regular SQL except in the following ways:
- It can invoke join relationships and stored expressions from `table` statements.
- It prevents users from accidentally aggregating incorrectly through joins.

These differences are described in the sections below.

#### Using join relationships in queries

If a `table` has join relationships declared in it, a `select` query on that table can leverage that join without needing to write its own join statement. This is helpful for query writers who have not memorized all the correct join keys.

If you recall the model from before:

```sql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  join_one users on user_id = users.id,

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,
  country_code VARCHAR,

  join_many orders on id = orders.user_id
)
```

We can write a query that leverages the modeled join relationship between `orders` and `users`:


```sql
-- Top 10 customers by order count
select
  users.name, -- Use the dot operator to traverse the modeled join relationship
  count(*)
from orders -- A join statement here is not needed
group by 1
order by 2 desc
limit 10
```

##### Multi-hop joins

Sometimes you need to access columns or stored expressions in a table that is two or more joins away from the `from` table. To do this, simply use more dot operators to trace the desired join path. For example, say there is another table added to our project, `countries`:

```sql
table orders (
  ...

  join_one users on user_id = users.id
)

table users (
  ...

  join_many orders on id = orders.user_id,
  join_one country on country_code = countries.code
)

table countries (
  code VARCHAR primary_key,
  name VARCHAR,
  currency VARCHAR,
  free_shipping BOOLEAN,

  join_many users on code = users.country_code
)
```

We can write the following query to show the top ten countries by order count:

```sql
-- Top 10 countries by order count
select
  users.countries.name, -- Orders -> Users -> Countries
  count(*)
from orders
group by 1
order by 2 desc
limit 10
```

#### Using stored expressions in queries

A stored expression can be invoked in a query by simply referencing it by name.

Again, using the model from before:

```sql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  join_one users on user_id = users.id,

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,
  country_code VARCHAR,

  join_many orders on id = orders.user_id
)
```

We can count the number of orders that were revenue-recognized vs. not:

```sql
-- Number of revenue-recognized orders vs. not
select
  revenue_recognized, -- Stored expression in orders
  count(*)
from orders
group by 1
```

This would be equivalent to:

```sql
select
  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,
  count(*)
from orders
group by 1 
```

You can see that invoking a stored expression is like using a macro: the definition for the stored expression is effectively expanded in-line by Graphene when it runs the query.

This is an important concept to understand when invoking stored expressions that are **aggregative** (ie. contain agg functions). Here's an example.

```sql
-- Profit by month
select
  date_trunc(created_at, month) as month,
  profit
from orders
group by 1
order by 1 asc
```

Note that, while `profit` looks like a column here, it is _not_ a column. That's because this query is equivalent to:

```sql
select
  date_trunc(created_at, month) as month,
  sum(case when revenue_recognized then amount else 0 end) - sum(case when revenue_recognized then cost else 0 end) as profit -- Profit is defined as revenue - cogs, which respectively expands out to these two filtered sums
from orders
group by 1
order by 1 asc
```

For this reason, in a query you would never wrap an aggregative stored expression in a `sum()` or `avg()` or any other agg function for the same reason you would never write `sum(sum(foo))` in SQL. That would throw an error!

#### Safe aggregation in fan-outs

A common and dangerous user error in regular SQL is aggregating data incorrectly after joining tables. This can happen when rows of one table match multiple rows of another, and effectively get duplicated for each match.

For example, after joining `users` to `orders`, your joined result will have some users repeated multiple times if they've made multiple purchases. If you wanted to find the average age of customers over this joined result, simply using an `avg(users.age)` would be _incorrect_, because you would be weighting the average towards users with multiple purchases, rather than taking the true average.

GSQL aims to solve this problem. With the additional information provided via `join_one` and `join_many`, Graphene knows under which scenarios when row dupliation occurs, and will rewrite aggregative expressions in a way that ignores the duplicate rows.

The query `select avg(users.age) from orders` will be rewritten to the following SQL when Graphene queries the underlying database (this is for BigQuery, specifically):

```sql
SELECT 
   (CAST((
    (
      SUM(DISTINCT
        (CAST(ROUND(COALESCE(users_0.`age`,0)*(1*1.0), 9) AS NUMERIC) +
        (cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001
      ))
      -
       SUM(DISTINCT (cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)
    )/(1*1.0)) AS FLOAT64))/NULLIF(COUNT(DISTINCT CASE WHEN users_0.`age` IS NOT NULL THEN users_0.`id` END),0) as `col_0`
FROM `bigquery-public-data.thelook_ecommerce.orders` as base
 LEFT JOIN `bigquery-public-data.thelook_ecommerce.users` AS users_0
  ON users_0.`id`=base.`user_id`
```

You don't have to understand this; the point is that GSQL is minimizing the chances that naive users aggregate data incorrectly.

### `table as` statements

You can turn the output of any `select` statement into a table with `table foo as (select ...)`. Here's an example of an additional table `user_facts` added to the two tables from earlier:

```sql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  join_one users on user_id = users.id,

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,

  join_many orders on id = orders.user_id,
  join_one user_facts on id = user_facts.id,

  /* Scalar expressions */

  user_facts.ltv as ltv,
  user_facts.lifetime_orders as lifetime_orders
)

table user_facts as (
  select
    id,
    orders.revenue as ltv,
    count(orders.id) as lifetime_orders,
  from users
  group by id
)
```

`table as` statements are conceptually the same as view tables in regular SQL. A few things to note:
- You cannot yet declare join relationships or stored expressions directly in a `table as` statement. Other tables can declare join relationships to it, though, as shown above.
- In the example above, the `ltv` and `lifetime_orders` columns from `user_facts` are "hoisted" back into `users` so that they appear as if they are columns from `users`. This is simply a design choice which allows query writers to never need to know about `user_facts`.

### Other miscellaneous details about GSQL

- Trailing commas in `table` statements are optional.
- Trailing semicolons after `table` and `table as` statements are optional.
- The clauses in a `select` statement (`select`, `from`, `join`, `group by`, etc.) can be written in any order. They cannot be repeated, however.
- `group by all` is implied if aggregative and scalar expressions are both present in the `select` clause. This means that `group by` can be omitted and the query will still effectively execute the `group by all`.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` will return two columns.
- `count` is a reserved word. Do not alias your columns as `count`.
- Window functions and set operations are not supported.

## Graphene visualizations

Graphene data apps are written in Markdown with the addition of special Graphene HTML components. Markdown files can contain named GSQL queries in code fences that components can then refer to. Those queries can use any tables defined in .gsql files.

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

Note that components can also directly refer to Graphene tables in their `data` property; it is not always necessary to prepare data in a code-fenced query. Properties that take column references can also take whole GSQL expressions, as shown in the second line chart from the example above.

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
- `npm run graphene check` - Checks the syntax for the entire Graphene project.
- `npm run graphene compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run graphene run "<GSQL>"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run graphene serve` - Starts (or restarts) the dev server, which allows the user to view their Graphene app on localhost.
- `npm run graphene view <mdPath>` - Captures a screenshot of a given .md file, along with any errors encountered.

## AGENT INSTRUCTIONS

Follow these guidelines when working in a Graphene project.
- When formulating GSQL queries:
   - First check all available stored expressions to see if there are any you can use. DO NOT redefine important business definitions like `profit` if they've already been modeled!
   - Run your GSQL queries in the CLI first, _before_ you write them to a file. This way you can reason about the results to make sure they make sense.
- Do not try to search the web for Graphene-specific info; you will not find anything. All the documentation is in /docs.
- When writing to a .gsql file, check your code with `npm run graphene check`.
- When writing to a Graphene .md file:
  - First read ALL the linked component docs listed in [Components](#components) above.
  - Check your code with `npm run graphene check`.
  - Once there are no syntax errors, do a visual check by running `npm run graphene view <mdPath>` and looking at the .png it generates. 