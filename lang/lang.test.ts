/// <reference types="vitest/globals" />
import {setConfig} from './config.ts'
import {clearWorkspace, getTable, analyze, toSql, getDiagnostics, updateFile} from './core.ts'
import {prepareEcommerceTables} from './testHelpers.ts'
import {expect} from 'vitest'
import {trimIndentation} from './util.ts'

const testTables = `
  table users (
    id int primary_key
    name text
    -- email address of the user
    --# pii=true
    email text
    created_at timestamp
    age int

    join many orders on orders.user_id = id
    join many payments on payments.user_id = id

    total_orders: count(orders.id)
    amount_paid: sum(payments.amount)
    -- measure active_recently created_at > current_date - 30
  )

  table orders (
    id int primary_key
    user_id int
    amount int
    status text

    join one users on users.id = user_id
    join many order_items on order_items.order_id = id

    total_revenue: sum(amount)
    avg_order_value: sum(amount) / count()
    completed: status = 'completed'
  )

  table order_items (
    id int primary_key
    order_id int
    sku text
    quantity int

    join one orders on orders.id = order_id
  )

  table payments (
    id int primary_key
    user_id int
    payment_date timestamp
    amount int

    join one users on users.id = user_id
  )

`

describe('lang', () => {
  beforeAll(async () => {
    await prepareEcommerceTables()
  })

  beforeEach(() => {
    clearWorkspace()
    setConfig({root: ''})
    updateFile(testTables, 'models.gsql')
  })

  it('handles basic select query', async () => {
    expect('from users select id, name where id = 1')
      .toRenderSql('SELECT base."id" as "id", base."name" as "name" FROM users as base WHERE base."id"=1')
    await expect('from users select id, name where id = 1')
      .toReturnRows([1, 'Alice'])
  })

  it('handles select 1 without from', async () => {
    expect('select 1')
      .toRenderSql('select 1')
    await expect('select 1')
      .toReturnRows([1])
  })

  it('uppercases identifiers for snowflake queries', () => {
    setConfig({dialect: 'snowflake', root: ''})
    expect('from users select id, orders.amount')
      .toRenderSql('SELECT base."ID" as "ID", ORDERS_0."AMOUNT" as "ORDERS_AMOUNT" FROM USERS as base LEFT JOIN ORDERS AS ORDERS_0 ON ORDERS_0."USER_ID"=base."ID"', {preserveCase: true})
  })

  it('uppercases nested join chains and query_source views for snowflake tables', () => {
    // clearWorkspace()
    setConfig({dialect: 'snowflake', root: ''})
    updateFile(`
      table users_chain (
        id int primary_key
        join many orders_chain on orders_chain.user_id = id
      )
      table orders_chain (
        id int primary_key
        user_id int
        join one order_item_view_chain on order_item_view_chain.order_id = id
      )
      table order_item_view_chain (
        order_id int primary_key
      )
    `, 'snowflake_chain.gsql')

    expect('from users_chain select orders_chain.order_item_view_chain.order_id')
      .toRenderSql(`SELECT ORDER_ITEM_VIEW_CHAIN_0."ORDER_ID" as "ORDERS_CHAIN_ORDER_ITEM_VIEW_CHAIN_ORDER_ID"
        FROM USERS_CHAIN as base LEFT JOIN ORDERS_CHAIN AS ORDERS_CHAIN_0 ON ORDERS_CHAIN_0."USER_ID"=base."ID"
        LEFT JOIN ORDER_ITEM_VIEW_CHAIN AS ORDER_ITEM_VIEW_CHAIN_0 ON ORDER_ITEM_VIEW_CHAIN_0."ORDER_ID"=ORDERS_CHAIN_0."ID"`, {preserveCase: true})
  })

  it('expands plain wildcard', () => {
    expect('from users select *')
      .toRenderSql('select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base')
  })

  it('expands wildcards on a specific join', () => {
    expect('from orders select users.*')
      .toRenderSql('select users_0."id" as "id", users_0."name" as "name", users_0."email" as "email", users_0."created_at" as "created_at", users_0."age" as "age" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('excludes aggregates from wildcard expansion', () => {
    // especially if those aggs are indirectly an agg agg expression
    expect('table t (amount int, sum(amount) / count() as weird_avg) from t select *')
      .toRenderSql('select base."amount" as "amount" from t as base')
  })

  it('expands dot-join syntax', () => {
    expect('from orders select id, users.name')
      .toRenderSql('select base."id" as "id", users_0."name" as "users_name" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('handles column naming when mutliple columns have the same name', () => {
    expect('from orders select users.id, order_items.id')
      .toRenderSql('select users_0."id" as "users_id", order_items_0."id" as "order_items_id" from orders as base left join users as users_0 on users_0."id"=base."user_id" left join order_items as order_items_0 on order_items_0."order_id"=base."id"')
  })

  it('expands measures', async () => {
    expect('from users select name, total_orders')
      .toRenderSql('select base."name" as "name", (count(distinct orders_0."id")) as "total_orders" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')

    await expect('from users select name, total_orders')
      .toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('handles expressions with aggregates', async () => {
    expect('from orders select user_id, avg_order_value')
      .toRenderSql('select base."user_id" as "user_id", (coalesce(sum(base."amount"),0)*1.0/count(1)) as "avg_order_value" from orders as base group by 1 order by 2 desc nulls last')

    await expect('from orders select user_id, avg_order_value')
      .toReturnRows([2, 40], [1, 30])
  })

  it('supports percentile aggregates via pXX shorthand', async () => {
    await expect('from orders select p10(amount) as min_amt, p50(amount) as median_amt, p999(amount) as max_amt')
      .toReturnRows([24, 40, 40])
  })

  it('executes asymmetric chasm avg through join', async () => {
    await expect('from orders select avg(users.age)')
      .toReturnRows([35])
  })

  it('counts across two unrelated joins (chasm trap safe)', async () => {
    await expect('from users select count(orders.id), count(payments.id)')
      .toReturnRows([3, 2])
  })

  it.skip('handles complex joins with measures', () => {
    expect('from products select name, category, total_sold where popular_item')
      .toRenderSql('select base."name" as "name", base."category" as "category", (sum(orders_0."amount")) as "total_sold" from products as base left join orders as orders_0 on orders_0."product_id"=base."id" group by 1, 2 having sum(orders_0."amount")>1000 order by 3 desc nulls last')
  })

  it.skip('handles subqueries', () => {
    expect('from (select id, name from users) select id, name')
      .toRenderSql(`WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`)
  })

  it.skip('handles subqueries with alias', () => {
    expect('from (select id, name from users) as u select id, name')
      .toRenderSql(`WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`)
  })

  it('supports "table as" (aka view) queries', async () => {
    updateFile(`
      table users (
        id int primary_key
        name string
        join many orders on orders.user_id = id
        join one user_facts on user_facts.id = id
        user_facts.ltv as ltv -- test out joining the view back in to its original source
      )
      table orders (id int primary_key, user_id int, amount int, sum(amount) as total_revenue)
      table user_facts as (from users select id, orders.total_revenue as ltv)
    `, 'models.gsql')

    await expect('from user_facts select id, ltv') // query the view directly
      .toReturnRows([1, 60], [2, 40])

    expect('from users select name, ltv') // query the view indirectly, through a join
      .toRenderSql('with __stage0 as ( select base."id" as "id", (coalesce(sum(orders_0."amount"),0)) as "ltv" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 ) select base."name" as "name", (user_facts_0."ltv") as "ltv" from users as base left join __stage0 as user_facts_0 on user_facts_0."id"=base."id"')

    await expect('select * from users') // wildcards should include ltv
      .toReturnRows([1, 'Alice', 60], [2, 'Bob', 40])
  })

  it('handles when the view is defined before the table', () => {
    // Covers a particular bug where if a view was analyzed before the table it queried, it'd break.
    // specifically the wildcard would include partially constructed joins
    clearWorkspace()
    updateFile('table user_facts as (from users select *)', 'facts.gsql')
    updateFile(testTables, 'models.gsql')

    expect('from user_facts select id, email order by id')
      .toRenderSql('with __stage0 as ( select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base ) select base."id" as "id", base."email" as "email" from __stage0 as base order by 1 asc nulls last')
  })

  it('qualified joins default to table name alias', () => {
    updateFile(`
      table dataset.users (id int primary_key, join many dataset.orders on id = orders.user_id)
      table dataset.orders (id int primary_key, user_id int)
    `, 'models.gsql')

    expect('from dataset.users select id, orders.id')
      .toRenderSql('select base."id" as "id", orders_0."id" as "orders_id" from dataset.users as base left join dataset.orders as orders_0 on base."id"=orders_0."user_id"')
  })

  it('extends derived tables with additional measures', async () => {
    updateFile(`${testTables}
      table user_facts as (from users select id, total_orders)
      extend user_facts (total_orders > 1 as repeat_buyer)
    `, 'models.gsql')

    await expect('from user_facts select id, total_orders, repeat_buyer order by id')
      .toReturnRows([1, 2, true], [2, 1, false])
  })

  it('supports select distinct', () => {
    expect('from users select distinct name, email')
      .toRenderSql('select base."name" as "name", base."email" as "email" from users as base group by 1,2 order by 1 asc nulls last')
  })

  it('coun(distinct)', () => {
    expect('from users select count(distinct name)')
      .toRenderSql('select count(distinct base."name") as "col_0" from users as base')
  })

  it('adds groupBy to select if needed', () => {
    expect('from users select count(orders.id) as total group by name')
      .toRenderSql('select base."name" as "name", count(distinct orders_0."id") as "total" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('doesnt duplicate groupBys', () => {
    expect('from users select name, count(orders.id) group by name')
      .toRenderSql('select base."name" as "name", count(distinct orders_0."id") as "col_1" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('group by can refer to an alias', () => {
    expect('from users select name as n group by n')
      .toRenderSql('select base."name" as "n" from users as base group by 1 order by 1 asc nulls last')
  })

  it.skip('group by positional number', () => {
    expect('from users select name, email group by 2, 1')
      .toRenderSql('select base."name" as "name", base."email" as "email" from users as base group by 2,1 order by 2 asc, 1 asc nulls last')
  })

  it('supports having clause with aggregate', async () => {
    await expect('from users select name, sum(payments.amount) as amt group by name having amt > 50')
      .toReturnRows(['Alice', 100])
  })

  it('supports post-agg filters without the need for "having"', async () => {
    await expect('from users select name, sum(payments.amount) as amt where amt > 50 group by name')
      .toReturnRows(['Alice', 100])
  })

  it('supports order by with direction', async () => {
    await expect('from users select name, total_orders order by total_orders desc')
      .toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('order by positional number', () => {
    expect('from users select name, email order by 2 asc, 1 desc')
      .toRenderSql('select base."name" as "name", base."email" as "email" from users as base order by 2 asc nulls last,1 desc nulls last')
  })

  it('supports limit clause', async () => {
    await expect('from users select name order by name asc limit 1')
      .toReturnRows(['Alice'])
  })

  it('supports is null/is not null', () => {
    expect('from users select name where email is null')
      .toRenderSql('select base."name" as "name" from users as base where base."email" is null')

    expect('from users select name where email is not null')
      .toRenderSql('select base."name" as "name" from users as base where base."email" is not null')
  })

  it('parses offset but reports diagnostic', () => {
    expect('from users select name order by name asc limit 1 offset 1')
      .toHaveDiagnostic(/offset is not supported yet/i)
  })

  it('supports in expressions', () => {
    expect("from users select id where name in ('Alice','Bob')")
      .toRenderSql('select base."id" as "id" from users as base where base."name" in (\'Alice\',\'Bob\')')
    expect("from users select id where name not in ('Alice','Bob')")
      .toRenderSql('select base."id" as "id" from users as base where base."name" not in (\'Alice\',\'Bob\')')
  })

  it('supports case expressions', () => {
    expect("from users select case when age > 35 then 'old' else 'young' end as bucket")
      .toRenderSql("select case when (base.\"age\">35) then 'old' else 'young' end as \"bucket\" from users as base")
  })

  it('reports syntax diagnostics on invalid query and still analyzes others', () => {
    expect('from users select id = >>;').toHaveDiagnostic(/syntax error/i)
  })

  it('reports syntax diagnostics on invalid table and still registers table name', () => {
    expect('table t (a int, !! ) ; from t select a;').toHaveDiagnostic(/syntax error/i)
  })

  it('parses metadata from comments on tables and fields (from testTables)', () => {
    analyze(`
      -- this is my test table
      table t (
        id int primary_key,
        -- a description
        --# format=first_last
        name text,
        another_field text, -- this is another field #units=seconds
      )
      from t select name
    `)
    let table = getTable('t')!
    expect(table.metadata.description.toLowerCase()).toContain('this is my test table')
    let name = table.fields.find(f => f.name === 'name') as any
    expect(name.metadata.description.toLowerCase()).toContain('a description')
    expect(name.metadata.format).toBe('first_last')
    let another = table.fields.find(f => f.name === 'another_field') as any
    expect(another.metadata.description.toLowerCase()).toContain('this is another field')
    expect(another.metadata.units).toBe('seconds')
  })

  it('does not attach a single leading comment to multiple fields on the same line', () => {
    analyze(`
      table foo (
        -- the name field
        id bigint, name varchar
      )`)
    let t = getTable('foo')!
    let id = (t.fields as any[]).find(f => f.name === 'id') as any
    let name = (t.fields as any[]).find(f => f.name === 'name') as any
    expect(id.metadata.description.toLowerCase()).toContain('name field')
    expect(name.metadata?.description).toBeUndefined()
  })

  it('reports diagnostics for multiple primary keys', () => {
    expect('table t (id int primary_key, id2 int primary_key) from t select id')
      .toHaveDiagnostic(/Table t has multiple primary keys/i)
  })

  it('reports diagnostics for duplicate table definitions', () => {
    expect(`
      table foo (id int)
      table foo (id int)
    `).toHaveDiagnostic(/table "foo" is already defined/i)
  })

  it('reports diagnostics for duplicate column definitions', () => {
    expect('table dup (id int, id text)').toHaveDiagnostic(/Table already has a field called "id"/i)
  })

  it('reports diagnostics for unsupported data types', () => {
    expect('table invalid (id int, value hyperthing)').toHaveDiagnostic(/Unsupported data type: hyperthing/i)
  })

  it('reports diagnostics when redefining an existing workspace table', () => {
    expect('table users (id int)').toHaveDiagnostic(/table "users" is already defined/i)
  })

  it('reports diagnostics for unknown table in FROM', () => {
    expect('from not_a_table select id')
      .toHaveDiagnostic(/could not find table "not_a_table"/i)
  })

  it('reports diagnostics for unknown column', () => {
    expect('from orders select users.does_not_exist')
      .toHaveDiagnostic(/could not find "does_not_exist" on users/i)
  })

  it('suggests join aliases when referencing table names', () => {
    expect(`
      table t (oid int, join one users as usr on usr.id = oid);
      from t select users.name
    `).toHaveDiagnostic(/did you mean "usr"\?/i)
  })

  it('can create new tables from queries', () => {
    expect(`table completed_orders as (from orders where status = 'completed' select id)
      from completed_orders select id`)
      .toRenderSql('WITH __stage0 AS ( SELECT base."id" as "id" FROM orders as base WHERE base."status"=\'completed\' ) SELECT base."id" as "id" FROM __stage0 as base')
  })

  it('handles asymmetric aggregates (avg, sum)', () => {
    expect('from orders select avg(users.age)')
      .toRenderSql('select ( select avg(a.val) as value from ( select unnest(list(distinct {key:users_0."id", val: users_0."age"})) a ) ) as "col_0" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('can correctly count through a join', () => {
    expect('from orders select count(users.id)')
      .toRenderSql('select count(distinct users_0."id") as "col_0" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('handles min/max through a join', () => {
    expect('from orders select min(users.age)')
      .toRenderSql('select min(users_0."age") as "col_0" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('can handle measures on unconnected join_manys', async () => {
    await expect('from users select name, total_orders, amount_paid, sum(orders.amount) as owed')
      .toReturnRows(['Alice', 2, 100, 60], ['Bob', 1, 50, 40])
  })

  it('handles measures across multiple fanouts', async () => {
    await expect('from users select name, orders.total_revenue, sum(orders.order_items.quantity)')
      .toReturnRows(['Alice', 60, 6], ['Bob', 40, 5])
  })

  it('non-builtin agg functions dont fanout', async () => {
    await expect('from users select name, amount_paid, count_if(orders.amount > 30) as big_ticket_order_count')
      .toReturnRows(['Alice', 100, 1], ['Bob', 50, 1])
  })

  it('supports function calling', () => {
    expect('from users select coalesce(name, \'Unknown\') as name2')
      .toRenderSql('select coalesce(base."name",\'Unknown\') as "name2" from users as base')
  })

  it('supports agg function calling', () => {
    expect('from users select age, string_agg(name)')
      .toRenderSql('select base."age" as "age", string_agg(base."name") as "col_1" from users as base group by 1 order by 2 desc nulls last')
  })

  it('supports asymmetric agg functions across joins', async () => {
    // as opposed to built-in sum/avg/etc, which aren't considered functions in malloy
    expect('from users select name, amount_paid, stddev(orders.amount) as test')
      .toRenderSql('select base."name" as "name", (coalesce(( select sum(a.val) as value from ( select unnest(list(distinct {key:payments_0."id", val: payments_0."amount"})) a ) ),0)) as "amount_paid", ( select stddev(a.val0) as value from ( select unnest(list(distinct {key:orders_0."id", val0: orders_0."amount"})) a ) ) as "test" from users as base left join payments as payments_0 on payments_0."user_id"=base."id" left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')

    await expect("from users select name, amount_paid, count_if(orders.status = 'pending') order by 1")
      .toReturnRows(['Alice', 100, 1], ['Bob', 50, 0])
  })

  it.skip('supports malloy date functions', () => {
    expect('from users select name, month(created_at)')
      .toRenderSql('select base."name" as "name", extract(month from base."created_at") as "col_1" from users as base')
  })

  it('allows queries with semicolons', () => {
    expect('table t (id int); select id, name from users;')
      .toRenderSql('select base."id" as "id", base."name" as "name" from users as base')
  })

  it('allows trailing commas in select/group/order/in lists and function args', () => {
    expect('select id, name, from users')
      .toRenderSql('select base."id" as "id", base."name" as "name" from users as base')

    expect('from users select count() group by name,')
      .toRenderSql('select base."name" as "name", count(1) as "col_0" from users as base group by 1 order by 2 desc nulls last')

    expect('from users select name order by name asc,')
      .toRenderSql('select base."name" as "name" from users as base order by 1 asc nulls last')

    expect("from users select id where name in ('Alice','Bob',)")
      .toRenderSql('select base."id" as "id" from users as base where base."name" in (\'Alice\',\'Bob\')')

    expect("from users select coalesce(name, 'Unknown',) as name2")
      .toRenderSql("select coalesce(base.\"name\",'Unknown') as \"name2\" from users as base")
  })

  it('allows optional commas between table items and semicolon terminators', () => {
    expect(`table t (
      id int primary_key,
      name text
    );
    from t select id, name`)
      .toRenderSql('select base."id" as "id", base."name" as "name" from t as base')

    expect(`table completed_ids as (from users select id,) ;
      from completed_ids select id`)
      .toRenderSql('WITH __stage0 AS ( SELECT base."id" as "id" FROM users as base ) SELECT base."id" as "id" FROM __stage0 as base')
  })

  it('supports count_if (function we added)', () => {
    expect('from orders select count_if(amount > 100)')
      .toRenderSql('select count_if(base."amount">100) as "col_0" from orders as base')
  })

  it('supports functions with keyword args', () => {
    setConfig({root: '', bigquery: {}})
    expect('from users select timestamp_diff(created_at, created_at, day)')
      .toRenderSql('select timestamp_diff(base.`created_at`,base.`created_at`,day) as `col_0` from `users` as base')
  })

  it('treats date part keywords as literals only when allowed', () => {
    setConfig({root: '', bigquery: {}})
    updateFile('table calendar (created_at timestamp, day text, week text)', 'calendar.gsql')

    expect('from calendar select week')
      .toRenderSql('select base.`week` as `week` from `calendar` as base')

    expect('from calendar select timestamp_diff(created_at, created_at, week)')
      .toRenderSql('select timestamp_diff(base.`created_at`,base.`created_at`,week) as `col_0` from `calendar` as base')

    expect('from calendar select date_trunc(created_at, week)')
      .toRenderSql('select date_trunc(base.`created_at`, week) as `col_0` from `calendar` as base')
  })

  it('supports extract expressions', () => {
    expect('from users select extract(hour from created_at)')
      .toRenderSql('select extract(hour from base."created_at") as "col_0" from users as base')
  })

  it('supports null and boolean literals', () => {
    expect('from users select name, null, true, FALSE')
      .toRenderSql('select base."name" as "name", null as "col_1", true as "col_2", false as "col_3" from users as base')
  })

  it('coerces string literals to timestamps', () => {
    expect("from users select id where created_at >= '2024-01-01'")
      .toRenderSql("select base.\"id\" as \"id\" from users as base where base.\"created_at\">=TIMESTAMP '2024-01-01 00:00:00'")
  })

  it('coerces string literals to timestamps inside in lists', () => {
    expect("from users select id where created_at in ('2024-01-01','2024-01-02')")
      .toRenderSql("select base.\"id\" as \"id\" from users as base where base.\"created_at\" in (TIMESTAMP '2024-01-01 00:00:00',TIMESTAMP '2024-01-02 00:00:00')")
  })

  it('coerces string literals to intervals when needed', () => {
    expect("from users select created_at + '5 minutes' as shifted")
      .toRenderSql('select base."created_at" + interval (5) minute as "shifted" from users as base')
  })

  it('diagnoses invalid interval literals', () => {
    expect("from users select created_at + 'many moons'")
      .toHaveDiagnostic(/Could not parse interval/i)
  })

  it('coerces temporal parameters', () => {
    let queries = analyze(`${testTables}
      from users select id where created_at >= $start_date
    `)
    expect(toSql(queries[0], {start_date: '2024-01-01'})).toMatch(/>=TIMESTAMP '2024-01-01 00:00:00'/)
  })

  it('diagnoses invalid timestamp literals', () => {
    expect("from users select id where created_at >= 'soonish'")
      .toHaveDiagnostic(/Could not parse timestamp literal/i)
  })

  it('warns on multiple joins in aggregate functions', async () => {
    expect('from users select name, sum(orders.amount + payments.amount)')
      .toHaveDiagnostic(/Graphene only supports a single table within aggregates. This one has: orders, payments/i)

    expect('from users select name, sum(age + payments.amount)') // this also includes fields on the base table
      .toHaveDiagnostic(/Graphene only supports a single table within aggregates. This one has: users, payments/i)

    // scalar functions can have multiple structPaths
    await expect('from users select name, greatest(sum(orders.amount), sum(payments.amount))')
      .toReturnRows(['Alice', 100], ['Bob', 50])
  })

  it.skip('errors when aggregates are nested', () => {
    expect('from users select name, sum(total_orders)')
      .toHaveDiagnostic(/Aggregates cannot be nested/i)
  })

  it.skip('errors if you have a non-agg measure that uses a join_many', () => {
    expect(`table t (
      uid int
      join many users on users.id = uid
      users.age as user_age
    )`).toHaveDiagnostic(/Fields that refer to a `join many` should aggregate/i)
  })

  it('allows join expressions to refer to the alias', () => {
    expect('table t (oid int, join one users as usr on usr.id = oid); from t select usr.name')
      .toRenderSql('select usr_0."name" as "usr_name" from t as base left join users as usr_0 on usr_0."id"=base."oid"')
  })

  it('allows measures to refer to themselves', () => {
    expect('table t (oid int, count(distinct t.oid) as total_oids)').toHaveNoErrors()
  })

  it('replaces parameters in filter conditions', () => {
    let queries = analyze(`${testTables}
      from users select id where name = $name
    `)
    expect(toSql(queries[0], {name: 'Alice'})).toMatch(/WHERE base\."name"='Alice'/)
  })

  it('supports duckdb current datetime functions', () => {
    expect(`
      from users select
        current_date(),
        current_time(),
        current_timestamp(),
        current_timestamp(3),
        local_timestamp()
    `).toRenderSql('select current_date() as "col_0", current_time() as "col_1", current_timestamp() as "col_2", current_timestamp(3) as "col_3", localtimestamp() as "col_4" from users as base')
  })

  it('supports bigquery current datetime functions with optional args', () => {
    setConfig({root: '', bigquery: {}})
    try {
      expect(`
        from users select
          current_date(),
          current_date('America/Los_Angeles'),
          current_time(),
          current_time('UTC'),
          current_timestamp(),
          current_timestamp('America/Los_Angeles'),
          local_timestamp(),
          current_datetime(),
          current_datetime('UTC')
      `).toRenderSql("select current_date() as `col_0`, current_date('America/Los_Angeles') as `col_1`, current_time() as `col_2`, current_time('UTC') as `col_3`, current_timestamp() as `col_4`, current_timestamp('America/Los_Angeles') as `col_5`, current_datetime() as `col_6`, current_datetime() as `col_7`, current_datetime('UTC') as `col_8` from `users` as base")
    } finally {
      setConfig({root: ''})
    }
  })

  it.skip('applies parameters inside views', () => {
    let queries = analyze(`${testTables}
      table active_users as (from users select id where age > $minAge)
      from active_users select id
    `)
    expect(toSql(queries[0], {minAge: 20})).toMatch(/WHERE base\."age">20/)
  })

  it.skip('supports array parameters in filters', () => {
    let queries = analyze(`${testTables}
      from users select id where name in ($names)
    `)
    let sql = toSql(queries[0], {names: ['Alice', 'Bob']})
    expect(sql).toMatch(/IN \(\(ARRAY\['Alice','Bob'\]\)\)/)
  })

  it('assumes * when no fields are selected', () => {
    expect('from users')
      .toRenderSql('select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base')
  })

  it('can analyze markdown files', () => {
    expect(`## My analysis
      \`\`\`gsql test
        from users where age > 20
      \`\`\`
      <BarChart data="test" x="name" y="avg(age)" />
    `).toRenderSql('with __stage0 as ( select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base where base."age">20 ) select base."name" as "name", avg(base."age") as "col_1" from __stage0 as base group by 1 order by 2 desc nulls last')
  })

  it('reports the right line/col number for markdown errors', () => {
    analyze(trimIndentation(`## My analysis
      \`\`\`gsql test
        from users where discount > 20
      \`\`\`
    `), 'md')
    let errors = getDiagnostics()
    expect(errors.length).toBe(1)
    expect(errors[0].from.line).toBe(2)
    expect(errors[0].from.col).toBe(19)
    expect(errors[0].to.col).toBe(27)
  })

  it('marks markdown component attribute errors across the attribute value', () => {
    analyze('<BarChart data="users" x="code" y="age" />', 'md')
    let errors = getDiagnostics()
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Could not find "code"')
    expect(errors[0].from.line).toBe(0)
    expect(errors[0].from.col).toBe(26)
    expect(errors[0].to.col).toBe(errors[0].from.col + 4)
  })

  it('handles params in a md code fence', () => {
    let queries = analyze('```gsql test\nfrom users where age > $cutoff\n```\n<BarChart data="test" x="name" y="avg(age)" />', 'md')
    let sql = toSql(queries[0], {cutoff: 20})
    expect(sql).toMatch(/"age">20/)
  })

  it('trimmed sanitization breaks a simple join cycle', () => {
    clearWorkspace()
    setConfig({root: ''})
    updateFile(`
      table alpha (
        id int primary_key
        join many beta on beta.alpha_id = id
        avg(beta.num) as avg_num
      )

      table beta (
        id int primary_key
        alpha_id int
        num int
        join one alpha on alpha.id = alpha_id
      )
    `, 'cycle.gsql')
    expect('from alpha select count(*)').toRenderSql('select count(1) as "col_0" from alpha as base')
    expect('from alpha select avg_num').toRenderSql('select (avg(beta_0."num")) as "avg_num" from alpha as base left join beta as beta_0 on beta_0."alpha_id"=base."id"')
    // expect('from beta select alpha.avg_num').toRenderSql('')
  })

  it('supports legacy computed column syntax (expr as alias)', () => {
    updateFile(`
      table users (
        id int primary_key,
        name text,
        age int,
        age >= 18 as is_adult
      )
    `, 'models.gsql')

    expect('from users select name where is_adult')
      .toRenderSql('select base."name" as "name" from users as base where (base."age">=18)')
  })

  it('has correct precedence between binary and logic expressions', () => {
    updateFile(`
      table flights (
        cancelled text,
        diverted text,
        is_cancelled_or_diverted: cancelled = 'Y' or diverted = 'Y'
      )
    `, 'flights.gsql')

    expect('from flights select is_cancelled_or_diverted').toHaveNoErrors()
  })

  it('supports parens on RHS of comparison', () => {
    updateFile(`
      table t (
        a int,
        b int,
        c: a = (b)
      )
    `, 'parens.gsql')
    expect('from t select c').toHaveNoErrors()
  })

  it('infers correct type for min/max', () => {
    expect('from users select min(created_at)').toHaveNoErrors()
    expect('from users select extract(year from min(created_at))').toHaveNoErrors()
  })
})
