/// <reference types="vitest/globals" />
import { setConfig } from './config.ts'
import {clearWorkspace, getTable, analyze, getDiagnostics} from './core.ts'
import {prepareEcommerceTables, setTestPrelude} from './testHelpers.ts'
import {expect} from 'vitest'

const testTables = `
  table users (
    id int primary_key
    name text
    -- email address of the user
    --# pii=true
    email text
    created_at timestamp
    age int

    join_many orders on orders.user_id = id
    join_many payments on payments.user_id = id
    count(orders.id) as total_orders
    sum(payments.amount) as amount_paid
    -- measure active_recently created_at > current_date - 30
  )

  table orders (
    id int primary_key
    user_id int
    amount int
    status text

    join_one users on users.id = user_id
    join_many order_items on order_items.order_id = id
    sum(amount) as total_revenue
    sum(amount) / count() as avg_order_value
    status = 'completed' as completed
  )

  table order_items (
    id int primary_key
    order_id int
    sku text
    quantity int

    join_one orders on orders.id = order_id
  )

  table payments (
    id int primary_key
    user_id int
    payment_date timestamp
    amount int

    join_one users on users.id = user_id
  )
`

describe('lang', () => {
  beforeAll(async () => {
    await prepareEcommerceTables()
  })

  beforeEach(() => {
    clearWorkspace()
    setTestPrelude(testTables)
    setConfig({dialect: 'duckdb'})
  })

  it('handles basic select query', async () => {
    expect('from users select id, name where id = 1')
      .toRenderSql('SELECT base."id" as "id", base."name" as "name" FROM users as base WHERE base."id"=1')
    await expect('from users select id, name where id = 1')
      .toReturnRows([1, 'Alice'])
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
    expect(`table t (amount int, sum(amount) / count() as weird_avg)
    from t select *`).toRenderSql('select base."amount" as "amount" from t as base')
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

  it('handles subqueries', () => {
    expect('from (select id, name from users) select id, name')
      .toRenderSql(`WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`)
  })

  it('handles subqueries with alias', () => {
    expect('from (select id, name from users) as u select id, name')
      .toRenderSql(`WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`)
  })

  it('supports select distinct', () => {
    expect('from users select distinct name, email')
      .toRenderSql('select base."name" as "name", base."email" as "email" from users as base group by 1,2 order by 1 asc nulls last')
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

  it('reports diagnostics for unknown table in FROM', () => {
    expect('from not_a_table select id')
      .toHaveDiagnostic(/could not find table not_a_table/i)
  })

  it('reports diagnostics for unknown column', () => {
    expect('from orders select users.does_not_exist')
      .toHaveDiagnostic(/could not find does_not_exist on users/i)
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

  it('supports function calling', () => {
    expect('from users select coalesce(name, \'Unknown\') as name2')
      .toRenderSql('select coalesce(base."name",\'Unknown\') as "name2" from users as base')
  })

  it('supports agg function calling', () => {
    expect('from users select age, string_agg(name)')
      .toRenderSql('select base."age" as "age", string_agg(base."name") as "col_1" from users as base group by 1 order by 2 desc nulls last')
  })

  it('supports asymmetric agg functions across joins', () => {
    // as opposed to built-in sum/avg/etc, which aren't considered functions in malloy
    expect('from users select name, amount_paid, stddev(orders.amount) as test')
      .toRenderSql('select base."name" as "name", (coalesce(( select sum(a.val) as value from ( select unnest(list(distinct {key:payments_0."id", val: payments_0."amount"})) a ) ),0)) as "amount_paid", ( select stddev(a.val0) as value from ( select unnest(list(distinct {key:base."id", val0: orders_0."amount"})) a ) ) as "test" from users as base left join payments as payments_0 on payments_0."user_id"=base."id" left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')

    expect('from users select name, total_orders, string_agg(payments.amount)')
      .toReturnRows(['Alice', 2, '100'], ['Bob', 1, '50'])
  })

  it('supports malloy date functions', () => {
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
})
