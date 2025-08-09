/// <reference types="vitest/globals" />
import {analyze} from './analyze.ts'
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

    join_one orders on orders.user_id = users.id,
    measure total_orders count(orders.id),
    measure active_recently created_at > current_date - 30
  )

  table orders (
    id int,
    user_id int,
    product_id int,
    -- amount in usd
    --# units=usd
    amount numeric,
    status text,

    join_one users on users.id = orders.user_id,
    join_one products on products.id = orders.product_id,
    measure total_revenue sum(amount),
    measure avg_order_value sum(amount) / count(*),
    measure completed status = 'completed'
  )

  table products (
    id int,
    name text,
    price numeric,
    category text,

    measure total_sold sum(orders.amount),
    measure popular_item total_sold > 1000
  )
`

function testQuery (grapheneSql: string, expectedSql: string) {
  let sql = testTables + '\n\n' + grapheneSql
  if (DEBUG) console.log('Query: ', grapheneSql)
  let result = analyze(sql)

  // Assert there are no diagnostics for valid inputs
  let diagnostics = [...result.tables, ...result.queries].flatMap(t => t.diagnostics || [])
  expect(diagnostics).toHaveLength(0)

  let clean = (s:string) => s.toLowerCase().replace(/\s+/g, ' ')
  expect(clean(result.queries[0].sql)).toBe(clean(expectedSql))
}

describe('lang', () => {
  it('handles basic select query', () => {
    testQuery(
      'SELECT id, name from users where id = 1',
      'SELECT users.id, users.name FROM users WHERE users.id = 1',
    )
  })

  it('supports from-first syntax', () => {
    testQuery(
      "from users select id, name where email like '%@example.com'",
      "SELECT users.id, users.name FROM users WHERE users.email like '%@example.com'",
    )
  })

  it('expands dot-join syntax', () => {
    testQuery(
      'from orders select id, users.name, products.name',
      'SELECT orders.id, users.name, products.name FROM orders LEFT JOIN users ON (users.id = orders.user_id) LEFT JOIN products ON (products.id = orders.product_id)',
    )
  })

  it('expands measures', () => {
    testQuery(
      'from users select name, total_orders',
      'SELECT users.name, COUNT(orders.id) FROM users LEFT JOIN orders ON (orders.user_id = users.id) GROUP BY ALL',
    )
  })

  it('handles nested measure references', () => {
    testQuery(
      'from orders select user_id, avg_order_value',
      'SELECT orders.user_id, SUM(orders.amount) / COUNT(*) FROM orders GROUP BY ALL',
    )
  })

  it('combines multiple features', () => {
    testQuery(
      'from orders where completed select users.name, total_revenue, products.category',
      "SELECT users.name, SUM(orders.amount), products.category FROM orders LEFT JOIN users ON (users.id = orders.user_id) LEFT JOIN products ON (products.id = orders.product_id) WHERE orders.status = 'completed' GROUP BY ALL",
    )
  })

  it.skip('handles complex joins with measures', () => {
    testQuery(
      'from products select name, category, total_sold where popular_item',
      'SELECT products.name, products.category, SUM(orders.amount) FROM products LEFT JOIN orders ON (orders.product_id = products.id) GROUP BY ALL HAVING SUM(orders.amount) > 1000',
    )
  })

  it('reports syntax diagnostics on invalid query and still analyzes others', () => {
    let sql = testTables + '\n' + 'from users select id; from users select id = ; from users select name;'
    let {queries} = analyze(sql)
    expect(queries.length).toBe(3)
    expect(queries[0].diagnostics.length).toBe(0)
    expect(queries[1].diagnostics.length).toBeGreaterThan(0)
    expect(queries[1].diagnostics[0].message.toLowerCase()).toContain('syntax')
    expect(queries[2].diagnostics.length).toBe(0)
  })

  it('reports syntax diagnostics on invalid table and still registers table name', () => {
    let sql = 'table t (a int, ; ) ; from t select a;'
    let {tables, queries} = analyze(sql)
    expect(tables.length).toBe(1)
    expect(tables[0].name.toLowerCase()).toBe('t')
    expect((tables[0].diagnostics?.length || 0)).toBeGreaterThan(0)
    expect(queries[0].sql.toLowerCase()).toContain('from t')
  })

  it('parses metadata from comments on tables and fields (from testTables)', () => {
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

  it('does not attach a single leading comment to multiple fields on the same line', () => {
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
    let {queries} = analyze(sql)
    expect(queries[0].diagnostics.length).toBeGreaterThan(0)
    expect(queries[0].diagnostics[0].message.toLowerCase()).toContain('unknown table')
  })

  it('reports diagnostics for unknown column', () => {
    let sql = testTables + '\n' + 'from orders select users.does_not_exist'
    let {queries} = analyze(sql)
    expect(queries[0].diagnostics.length).toBeGreaterThan(0)
    expect(queries[0].diagnostics[0].message.toLowerCase()).toContain("couldn't find column")
  })
})
