/// <reference types="vitest/globals" />
import {analyze, clearWorkspace, getTable} from './analyze.ts'
import {setTestPrelude} from './testHelpers.ts'
import {expect} from 'vitest'

const testTables = `
  -- people who purchase things
  --# domain=sales
  table users (
    id int primary_key,
    name text,
    -- email address of the user
    --# pii=true
    email text,
    created_at timestamp,
    age int,

    join_many orders on orders.user_id = id,
    measure total_orders count(orders.id)
    -- measure active_recently created_at > current_date - 30
  )

  table orders (
    id int,
    user_id int,
    product_id int,
    -- amount in usd
    --# units=usd
    amount int,
    status text,

    join_one users on users.id = user_id,
    join_one products on products.id = product_id,
    measure total_revenue sum(amount),
    measure avg_order_value sum(amount) / count(),
    measure completed status = 'completed'
  )

  table products (
    id int,
    name text,
    price int,
    category text,

    join_many orders on orders.product_id = id
    -- measure total_sold sum(orders.amount),
    -- measure popular_item total_sold > 1000
  )
`

describe('lang', () => {
  beforeEach(() => {
    clearWorkspace()
    setTestPrelude(testTables)
  })

  it('handles basic select query', () => {
    expect('SELECT id, name from users where id = 1')
      .toRenderSql('SELECT base."id" as "id", base."name" as "name" FROM users as base WHERE base."id"=1')
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

  it('supports from-first syntax', () => {
    expect("from users select id, name where email like '%@example.com'")
      .toRenderSql("select base.\"id\" as \"id\", base.\"name\" as \"name\" from users as base where base.\"email\" like '%@example.com'")
  })

  it('expands dot-join syntax', () => {
    expect('from orders select id, users.name')
      .toRenderSql('select base."id" as "id", users_0."name" as "users_name" from orders as base left join users as users_0 on users_0."id"=base."user_id"')
  })

  it('handles column naming when mutliple columns have the same name', () => {
    expect('from orders select users.name, products.name')
      .toRenderSql('select users_0."name" as "users_name", products_0."name" as "products_name" from orders as base left join users as users_0 on users_0."id"=base."user_id" left join products as products_0 on products_0."id"=base."product_id"')
  })

  it('expands measures', () => {
    expect('from users select name, total_orders')
      .toRenderSql('select base."name" as "name", (count(distinct orders_0."id")) as "total_orders" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('handles nested measure references', () => {
    expect('from orders select user_id, avg_order_value')
      .toRenderSql('select base."user_id" as "user_id", (coalesce(sum(base."amount"),0)*1.0/count(1)) as "avg_order_value" from orders as base group by 1 order by 2 desc nulls last')
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

  it('reports syntax diagnostics on invalid query and still analyzes others', () => {
    expect('from users select id = >>;').toHaveDiagnostic(/syntax error/i)
  })

  it('reports syntax diagnostics on invalid table and still registers table name', () => {
    expect('table t (a int, ; ) ; from t select a;').toHaveDiagnostic(/syntax error/i)
  })

  it('parses metadata from comments on tables and fields (from testTables)', () => {
    analyze(testTables + '\nfrom users select id')
    let users = getTable('users')!
    expect(users.metadata.description.toLowerCase()).toContain('people who purchase things')
    expect(users.metadata.domain).toBe('sales')
    let email = (users.fields as any[]).find(f => f.name === 'email') as any
    expect(email.metadata.description.toLowerCase()).toContain('email address')
    expect(email.metadata.pii).toBe('true')
    let orders = getTable('orders')!
    let amount = (orders.fields as any[]).find(f => f.name === 'amount') as any
    expect(amount.metadata.units).toBe('usd')
  })

  it('does not attach a single leading comment to multiple fields on the same line', () => {
    let sql = `
    table foo (
      -- the name field
      id bigint, name varchar
    )
    from foo select id` // include a query to force parse
    analyze(sql)
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

  it.skip('supports join_many', () => {
    expect('from users select id, total_orders')
      .toRenderSql('')
  })
})
