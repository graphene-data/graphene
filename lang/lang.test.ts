/// <reference types="vitest/globals" />
import {clearWorkspace, getTable, analyze} from './core.ts'
import {prepareEcommerceTables, setTestPrelude} from './testHelpers.ts'
import {expect} from 'vitest'

const testTables = `
  table users (
    id int primary_key,
    name text,
    -- email address of the user
    --# pii=true
    email text,
    created_at timestamp,
    age int,

    join_many orders on orders.user_id = id,
    join_many payments on payments.user_id = id,
    measure total_orders count(orders.id),
    measure amount_paid sum(payments.amount)
    -- measure active_recently created_at > current_date - 30
  )

  table orders (
    id int primary_key,
    user_id int,
    amount int,
    status text,

    join_one users on users.id = user_id,
    join_many order_items on order_items.order_id = id,
    measure total_revenue sum(amount),
    measure avg_order_value sum(amount) / count(),
    measure completed status = 'completed'
  )

  table order_items (
    id int primary_key,
    order_id int,
    sku text,
    quantity int,

    join_one orders on orders.id = order_id
  )

  table payments (
    id int primary_key,
    user_id int,
    payment_date timestamp,
    amount int,

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
    expect(`table t (amount int, measure weird_avg sum(amount) / count())
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

  it('expands measures', () => {
    expect('from users select name, total_orders')
      .toRenderSql('select base."name" as "name", (count(distinct orders_0."id")) as "total_orders" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('computes a measure result', async () => {
    await expect('from users select name, total_orders')
      .toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('handles nested measure references', () => {
    expect('from orders select user_id, avg_order_value')
      .toRenderSql('select base."user_id" as "user_id", (coalesce(sum(base."amount"),0)*1.0/count(1)) as "avg_order_value" from orders as base group by 1 order by 2 desc nulls last')
  })

  it('returns rows for nested measure', async () => {
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

  it('adds groupBy to select if needed', () => {
    expect('from users select count(orders.id) as total group by name')
      .toRenderSql('select base."name" as "name", count(distinct orders_0."id") as "total" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('doesnt duplicate groupBys', () => {
    expect('from users select name, count(orders.id) group by name')
      .toRenderSql('select base."name" as "name", count(distinct orders_0."id") as "col_1" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
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

  it('supports limit clause', async () => {
    await expect('from users select name order by name asc limit 1')
      .toReturnRows(['Alice'])
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
    expect('table t (a int, ; ) ; from t select a;').toHaveDiagnostic(/syntax error/i)
  })

  it('parses metadata from comments on tables and fields (from testTables)', () => {
    analyze(`
      -- this is my test table
      table t (
        id int primary_key,
        -- a description
        --# format=first_last
        name text
      )
      from t select name
    `)
    let table = getTable('t')!
    expect(table.metadata.description.toLowerCase()).toContain('this is my test table')
    let name = table.fields.find(f => f.name === 'name') as any
    expect(name.metadata.description.toLowerCase()).toContain('a description')
    expect(name.metadata.format).toBe('first_last')
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
})
