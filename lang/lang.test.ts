/// <reference types="vitest/globals" />
import {analyze, clearWorkspace, toSql} from './analyze.ts'
import {expect} from 'vitest'

const DEBUG = !!process.env.DEBUG

const testTables = `
  -- people who purchase things
  --# domain=sales
  table users (
    id int,
    name text,
    -- email address of the user
    --# pii=true
    email text,
    created_at timestamp,

    join_one orders on orders.user_id = id,
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

  table completed_orders as (
    from orders where status = 'completed' select id
  )

  table products (
    id int,
    name text,
    price int,
    category text

    -- join_many orders on orders.product_id = id
    -- measure total_sold sum(orders.amount),
    -- measure popular_item total_sold > 1000
  )
`

function testQuery (grapheneSql: string, expectedSql: string) {
  let sql = testTables + '\n\n' + grapheneSql
  if (DEBUG) console.log('Query: ', grapheneSql)
  let {queries, diagnostics} = analyze(sql)
  expect(diagnostics).toHaveLength(0)
  expect(queries).toHaveLength(1)

  let result = toSql(queries[0])
  if (DEBUG) console.log('Result: ', result)
  let clean = (s:string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s+$/, '')
  expect(clean(result)).toBe(clean(expectedSql))
}

describe('lang', () => {
  beforeEach(() => {
    clearWorkspace()
  })

  it('handles basic select query', () => {
    testQuery(
      'SELECT id, name from users where id = 1',
      'SELECT base."id" as "id", base."name" as "name" FROM users as base WHERE base."id"=1',
    )
  })

  it('expands plain wildcard', () => {
    testQuery(
      'from users select *',
      'select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at" from users as base',
    )
  })

  it('expands wildcards on a specific join', () => {
    testQuery(
      'from orders select users.*',
      'select users_0."id" as "id", users_0."name" as "name", users_0."email" as "email", users_0."created_at" as "created_at" from orders as base left join users as users_0 on users_0."id"=base."user_id"',
    )
  })

  it('supports from-first syntax', () => {
    testQuery(
      "from users select id, name where email like '%@example.com'",
      'select base."id" as "id", base."name" as "name" from users as base where base."email" like \'%@example.com\'',
    )
  })

  it('expands dot-join syntax', () => {
    testQuery(
      'from orders select id, users.name',
      'select base."id" as "id", users_0."name" as "users_name" from orders as base left join users as users_0 on users_0."id"=base."user_id"',
    )
  })

  it.skip('handles column naming when mutliple columns have the same name', () => {
    testQuery(
      'from orders select users.name, products.name',
      'SELECT orders.id, users.name, products.name FROM orders LEFT JOIN users ON (users.id = orders.user_id) LEFT JOIN products ON (products.id = orders.product_id)',
    )
  })

  it('expands measures', () => {
    testQuery(
      'from users select name, total_orders',
      'select base."name" as "name", (count(1)) as "total_orders" from users as base left join orders as orders_0 on orders_0."user_id"=base."id" group by 1,2 order by 1 asc nulls last',
    )
  })

  it('handles nested measure references', () => {
    testQuery(
      'from orders select user_id, avg_order_value',
      'select base."user_id" as "user_id", (coalesce(sum(base."amount"),0)*1.0/count(1)) as "avg_order_value" from orders as base',
    )
  })

  it.skip('handles complex joins with measures', () => {
    testQuery(
      'from products select name, category, total_sold where popular_item',
      'SELECT products.name, products.category, SUM(orders.amount) FROM products LEFT JOIN orders ON (orders.product_id = products.id) GROUP BY ALL HAVING SUM(orders.amount) > 1000',
    )
  })

  it('handles subqueries', () => {
    testQuery(
      'from (select id, name from users) select id, name',
      `WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`,
    )
  })

  it('handles subqueries with alias', () => {
    testQuery(
      'from (select id, name from users) as u select id, name',
      `WITH __stage0 AS ( SELECT base."id" as "id", base."name" as "name" FROM users as base )
      SELECT base."id" as "id", base."name" as "name" FROM __stage0 as base`,
    )
  })

  it('reports syntax diagnostics on invalid query and still analyzes others', () => {
    let sql = testTables + '\n' + 'from users select id = >>;'
    let {queries, diagnostics} = analyze(sql)
    expect(queries.length).toBe(1)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].message.toLowerCase()).toContain('syntax')
  })

  it('reports syntax diagnostics on invalid table and still registers table name', () => {
    let sql = 'table t (a int, ; ) ; from t select a;'
    let {queries, diagnostics} = analyze(sql)
    expect(queries.length).toBe(1)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(queries[0].malloyQuery.structRef).toEqual('t')
  })

  it.skip('parses metadata from comments on tables and fields (from testTables)', () => {
    let {tables} = analyze(testTables + '\nfrom users select id')
    let users = tables.find(t => t.name.toLowerCase() === 'users')!
    expect(users.metadata.description.toLowerCase()).toContain('people who purchase things')
    expect(users.metadata.domain).toBe('sales')
    let email = users.fields['email'] as any
    expect(email.metadata.description.toLowerCase()).toContain('email address')
    expect(email.metadata.pii).toBe('true')
    let orders = tables.find(t => t.name.toLowerCase() === 'orders')!
    let amount = orders.fields['amount'] as any
    expect(amount.metadata.units).toBe('usd')
  })

  it.skip('does not attach a single leading comment to multiple fields on the same line', () => {
    let sql = `
    table foo (
      -- the name field
      id bigint, name varchar
    )
    from foo select id` // include a query to force parse
    let {tables} = analyze(sql)
    let t = tables[0]
    let id = t.fields['id'] as any
    let name = t.fields['name'] as any
    expect(id.metadata.description.toLowerCase()).toContain('name field')
    expect(name.metadata?.description).toBeUndefined()
  })

  it('reports diagnostics for unknown table in FROM', () => {
    let sql = testTables + '\n' + 'from not_a_table select id'
    let {diagnostics} = analyze(sql)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].message.toLowerCase()).toContain('could not find table not_a_table')
  })

  it('reports diagnostics for unknown column', () => {
    let sql = testTables + '\n' + 'from orders select users.does_not_exist'
    let {diagnostics} = analyze(sql)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].message.toLowerCase()).toContain('could not find does_not_exist on users')
  })

  it('can create tables from queries', () => {
    testQuery(
      'from completed_orders select id',
      'WITH __stage0 AS ( SELECT base."id" as "id" FROM orders as base WHERE base."status"=\'completed\' ) SELECT base."id" as "id" FROM __stage0 as base',
    )
  })
})
