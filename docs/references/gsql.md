# Graphene SQL (GSQL)

GSQL abstracts over the underlying database SQL. Graphene translates GSQL into database SQL when running queries.  

GSQL is comprised of four primary statements: `table`, `select`, `table X as`, and `extend`.

## `table` statements

`table` statements declare tables that already exist in your database. Here's an example of two tables, `orders` and `users`, in GSQL.

```sql
table orders (

  -- Base columns

  id BIGINT
  user_id BIGINT
  created_at DATETIME
  status STRING -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT -- Amount paid by customer
  cost FLOAT -- Cost of materials

  -- Join relationships

  join one users on user_id = users.id

  -- Dimensions

  revenue_recognized: status in ('Processing', 'Shipped', 'Complete')
  
  -- Measures
  
  revenue: sum(case when revenue_recognized then amount else 0 end)
  cogs: sum(case when revenue_recognized then cost else 0 end)
  profit: revenue - cogs
  profit_margin: profit / revenue
)

table users (
  id BIGINT
  name VARCHAR
  email VARCHAR
  age INTEGER
  country_code VARCHAR

  join many orders on id = orders.user_id
)
```

We can break down a `table` statement into three parts: base columns, join relationships, and stored expressions (dimensions and measures).

### Base columns (required)

The base column set is simply a reflection of the underlying database table's schema. Similar to `create table` statements in regular SQL DDL, you list each column's name and data type.

### Join relationships

Join relationships in a `table` statement declare joins that can be used when querying them. This makes query writing easier and more foolproof.

The other main difference about joins in GSQL vs. regular SQL is that you have to explain if there are many rows in the left table for each row in the right table, or vice versa. This additional bit of information allows Graphene to prevent incorrect aggregation as a result of row duplication (aka fan-out) through joins.

This information is provided with the two supported join types, `join one` and `join many`:
- `join one` is used when each row in **this** table maps to at most one row in the **joined** table.
- `join many` is used when each row in **this** table can map to many rows in the **joined** table.

In the example above with `orders` and `users`, the joins confirm that there are many orders per user, and only one user per order.

Note that all joins in GSQL are left outer joins. There is no inner, right, or cross join.

#### Multiple join relationships between the same two tables

Sometimes there are multiple valid ways to join two tables together. You can model this in Graphene by aliasing the various joins with `as`, just as you would in normal SQL. For example:

```sql
table projects (
  ...
  owner_id BIGINT
  viewer_id BIGINT

  join one users as project_owner on owner_id = project_owner.id
  join one users as project_viewer on viewer_id = project_viewer.id
)

table users (
  ...
  id BIGINT

  join many projects as projects_as_owner on id = projects_as_owner.owner_id
  join many projects as projects_as_viewer on id = projects_as_viewer.viewer_id
)
```

#### Best practices for modeling join relationships

- For a given `table` statement, only model joins that are directly on that table. Multi-hop join paths do not need to be written explicitly in order for queries to traverse them.
- A join between two tables should be modeled in both the respective `table` statements. This may seem redundant but it offers more flexibility for queries to choose which table to set in the `from` (remember that direction matters in queries since all joins are left joins).

### Stored expressions

**Stored expressions** are GSQL expressions (ie. any arbitrary combination of functions, operators, and column references) that you want to make reusable to queries. Stored expressions are great for canonizing metrics, segments, and other important business definitions.

A stored expression must be given a name via `name: expression` or `expression as name`. It can then be referenced by name in queries that use the table.

Like expressions in regular SQL, expressions in GSQL are either scalar or aggregative. In BI parlance, these would be called dimensions and measures, respectively.

Expressions can refer to other expressions, as from the example before:

```sql
table orders (
  ...

  /* Scalar expressions */
  revenue_recognized: status in ('Processing', 'Shipped', 'Complete')

  /* Agg expressions */
  revenue: sum(case when revenue_recognized then amount else 0 end)
  cogs: sum(case when revenue_recognized then cost else 0 end)
  profit: revenue - cogs -- even though there are no agg functions here, this is still aggregative as it references other aggregative expressions
  profit_margin: profit / revenue
)
```

## `select` statements

`select` in GSQL has been extended to leverage join relationships, dimensions, and measures.

### Using join relationships

If a `table` has join relationships declared in it, a `select` query on that table can leverage that join without needing to write its own join statement. This is helpful for query writers who have not memorized all the correct join keys.

If you recall the model from before:

```sql
table orders (
  ...
  user_id BIGINT
  join one users on user_id = users.id
)

table users (
  id BIGINT
  name VARCHAR
  ...
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

#### Multi-hop joins

Sometimes you need to access columns or stored expressions in a table that is two or more joins away from the `from` table. To do this, simply use more dot operators to trace the desired join path. For example, say there is another table added to our project, `countries`:

```sql
table orders (
  ...

  join one users on user_id = users.id
)

table users (
  ...

  join many orders on id = orders.user_id
  join one countries on country_code = countries.code
)

table countries (
  code VARCHAR
  name VARCHAR
  currency VARCHAR
  free_shipping BOOLEAN

  join many users on code = users.country_code
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

### Using stored expressions in queries

A stored expression can be invoked in a query by simply referencing it by name.

Again, using the orders table from before:

```sql
table orders (
  id BIGINT
  user_id BIGINT
  created_at DATETIME
  status STRING -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT -- Amount paid by customer
  cost FLOAT -- Cost of materials

  join one users on user_id = users.id

  revenue_recognized: status in ('Processing', 'Shipped', 'Complete')
  revenue: sum(case when revenue_recognized then amount else 0 end)
  cogs: sum(case when revenue_recognized then cost else 0 end)
  profit: revenue - cogs
  profit_margin: profit / revenue
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

#### Using measures

The macro concept is important to understand when invoking stored expressions that are **aggregative** (ie. contain agg functions), which can also be called "measures." Here's an example.

```sql
-- Profit by status
select
  status,
  profit
from orders
group by 1
order by 1 asc
```

Note that, while `profit` looks like a column here, it is _not_ a column. That's because this query is equivalent to:

```sql
select
  status,
  sum(case when revenue_recognized then amount else 0 end) - sum(case when revenue_recognized then cost else 0 end) as profit -- Profit is defined as revenue - cogs, which respectively expands out to these two filtered sums
from orders
group by 1
order by 1 asc
```

[CRITICAL!] This means:
- You would NEVER wrap a measure in an agg function like `sum(my_measure)`, for the same reason that you cannot do `SUM(SUM(foo))` in regular SQL.
- You would NEVER group by a measure like `group by my_measure`, for the same reason that you cannot do `GROUP BY SUM(foo)` in regular SQL.
- You CAN wrap a measure in a scalar function like `floor(my_measure)`, for the same reason that can do `FLOOR(SUM(foo))` in regular SQL.
- You CAN compose measures together in expressions like `my_measure + my_other_measure`, for the same reason that you can do `SUM(foo) + SUM(bar)` in regular SQL.

Another way of thinking about this is that measures are "self-aggregating."

### Other miscellaneous details

- The clauses in a `select` statement (`select`, `from`, `join`, `group by`, etc.) can be written in any order. They cannot be repeated, however.
- `group by all` is implied if aggregative and scalar expressions are both present in the `select` clause. This means that `group by` can be omitted and the query will still effectively execute the `group by all`.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` will return two columns.
- `count` is a reserved word. Do not alias your columns as `count`.
- Window functions and set operations (`union [all]`, `intersect`, `except`) are not supported.
- Percentiles can be computed easily using Graphene's special functions `pXX(col)` (e.g., p50, p975, p9999).
- Graphene supports almost all functions of the connected data warehouse. Check package.json to see which database you're connected to.

## `table X as` statements

You can turn the output of any `select` statement into a table with `table foo as (select ...)`. Here's an example of an additional table `user_facts` added to the two tables from earlier:

```sql
table orders (
  id BIGINT
  user_id BIGINT
  created_at DATETIME
  status STRING -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT -- Amount paid by customer
  cost FLOAT -- Cost of materials

  join one users on user_id = users.id

  revenue_recognized: status in ('Processing', 'Shipped', 'Complete')
  revenue: sum(case when revenue_recognized then amount else 0 end)
  cogs: sum(case when revenue_recognized then cost else 0 end)
  profit: revenue - cogs
  profit_margin: profit / revenue
)

table users (
  id BIGINT
  name VARCHAR
  email VARCHAR
  age INTEGER

  join many orders on id = orders.user_id
  join one user_facts on id = user_facts.id

  ltv: user_facts.ltv
  lifetime_orders: user_facts.lifetime_orders
)

table user_facts as (
  select id, orders.revenue as ltv, count(orders.id) as lifetime_orders,
  from users group by id
)
```

`table X as` statements are conceptually the same as view tables and CTEs in regular SQL. A few things to note:
- You cannot declare join relationships or stored expressions directly in a `table X as` statement. Use an `extend` statement.
- In the example above, the `ltv` and `lifetime_orders` columns from `user_facts` are "hoisted" back into `users` so that they appear as if they are columns from `users`. This is simply a design choice which allows query writers to never need to know about `user_facts`.

## `extend` statements

`extend` statements allow you to add join relationships or stored expressions to an existing table. This is especially useful for tables created via `table X as` statements, which do not support defining these properties directly.

For example, if we have a `table X as` statement that creates a daily summary of orders:

```sql
table regional_orders as (
  select
    region,
    count(*) as num_orders,
    sum(amount) as total_revenue
  from orders
  group by 1
)
```

We can extend this table to add measures or joins:

```sql
extend regional_orders (
  join one regions on region = regions.name

  avg_order_value: total_revenue / num_orders
)
```
