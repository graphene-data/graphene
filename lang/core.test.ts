import {describe, it, expect} from 'vitest'
import {analyze} from './core'

const testTables = `
  table users (
    id number,
    name string,
    email string,
    created_at timestamp,

    join_one orders on orders.user_id = users.id,
    measure total_orders count(orders.id),
    measure active_recently created_at > current_date - 30
  )

  table orders (
    id number,
    user_id number,
    product_id number,
    amount number,
    status string,

    join_one users on users.id = orders.user_id,
    join_one products on products.id = orders.product_id,
    measure total_revenue sum(amount),
    measure avg_order_value sum(amount) / count(*),
    measure completed status = 'completed'
  )

  table products (
    id number,
    name string,
    price number,
    category string,

    join_many orders on orders.product_id = products.id,
    measure total_sold sum(orders.amount),
    measure popular_item total_sold > 1000
  )
`

function testQuery (grapheneSql: string, expectedSql: string) {
  let sql = testTables + '\n\n' + grapheneSql
  let [result] = analyze(sql)
  console.log('got', JSON.stringify(result))
  let clean = (s:string) => s.toLowerCase().replace(/\s+/g, ' ')
  expect(clean(result)).toBe(clean(expectedSql))
}

describe('lang', () => {
  it('handles basic select query', () => {
    testQuery(
      'select id, name from users where id = 1',
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
})
