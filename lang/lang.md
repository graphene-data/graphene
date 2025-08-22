We're creating a superset of SQL that allows for semantic modeling and some improved ergonomics.

# Tables
You can tell Graphene about tables in your database with a syntax that looks like `create table`
In addition to columns, you define joins and measures on a table.

```sql
  table flights (
    distance number,
    carrier string,
    fuel_load number,

    join_one aircraft on aircraft.tail_num = flights.tail_num,
    join_one carriers on carriers.code = flights.carrier,
    measure long_haul distance > 2000,
    measure seats_per_flight sum(aircraft.model.seats) / count(*),
  )
```

# Query features
* From first - you can specify the "from", "select", "where" clauses in any order. Usually "from" first is best, since it gives a lot of autocomplete context.
* Dot joins - When joins are defined on a table, you can expand them at query time. `from flights select aircraft.tail_number` will automatically join aircraft to flights.
* Measure expansion - you can refer to a measure as if it was a column, and in the final sql this gets expanded out. Measures can refer to other measures.
* Automatic group by - if your query contains aggregate functions, `group by all` is automatically added.
* LIMIT - `limit N` is supported on queries. `offset` is parsed but currently reports a diagnostic and is not executed.


# Features we might add in the future
* output dialects - ability to write sql into different dialects
* symetric aggregates - avoid (or at least warn about) fanout issues
* level of detail - like a "percent of total" column

* `union` and `union all`
* subqueries outside `from` - `where id in (select id from users where disabled)`
