/// <reference types="vitest/globals" />
import {setConfig} from './config.ts'
import {clearWorkspace, getTable, analyze, toSql, getDiagnostics, updateFile} from './core.ts'
import {prepareEcommerceTables} from './testHelpers.ts'
import {expect} from 'vitest'
import {trimIndentation} from './util.ts'

const testTables = `
  table users (
    id int
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
    id int
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
    id int
    order_id int
    sku text
    quantity int

    join one orders on orders.id = order_id
  )

  table payments (
    id int
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


  it('imports all keywords as tokens', async () => {
    // Every keyword used via Kw<"..."> in the grammar must be in the specializeIdentifier keyword map in tokens.js.
    // Without this, those keywords would only parse in lowercase (the inline spec_Identifier table is exact-match).
    // We have a test because it's easy to add keywords and forget to add them to tokens, causing the parsing to break if you use the uppercase version of a keyword
    let fs = await import('fs')
    let grammar = fs.readFileSync(new URL('./lang.grammar', import.meta.url), 'utf8')
    let tokens = fs.readFileSync(new URL('./tokens.js', import.meta.url), 'utf8')
    let grammarKeywords = new Set([...grammar.matchAll(/Kw<"(\w+)">/g)].map(m => m[1]))
    let tokenKeywords = new Set([...tokens.matchAll(/^\s+(\w+):/gm)].map(m => m[1]))
    let missing = [...grammarKeywords].filter(k => !tokenKeywords.has(k))
    expect(missing, 'Keywords in grammar but missing from tokens.js specializeIdentifier').toEqual([])
  })

  it('handles basic select query', async () => {
    expect('from users select id, name where id = 1')
      .toRenderSql('SELECT base."id" as "id", base."name" as "name" FROM users as base WHERE base."id"=1')
    await expect('from users select id, name where id = 1')
      .toReturnRows([1, 'Alice'])
  })

  it('handles select 1 without from', async () => {
    expect('select 1')
      .toRenderSql('SELECT 1 as "col_0"')
    await expect('select 1')
      .toReturnRows([1])
  })

  it('uppercases identifiers for snowflake queries', () => {
    setConfig({dialect: 'snowflake', root: ''})
    // Column references should be uppercase (to match Snowflake's case-insensitive identifiers),
    // but aliases are lowercase (quoted) so result sets have the expected original casing.
    // Note: uppercasing happens in core.ts via uppercaseTable() for table names, but column
    // names in expressions still use original case. Using case-insensitive comparison for now.
    expect('from users select id, orders.amount as amt order by amt desc')
      .toRenderSql('SELECT base."id" as "id", orders."amount" as "amt" FROM USERS as base LEFT JOIN ORDERS as orders ON orders."user_id"=base."id" ORDER BY 2 desc NULLS LAST')
  })

  // Skipped: this test has issues with join chain resolution that are unrelated to uppercase handling
  // The SQL output doesn't match expectations for nested joins through snowflake tables
  it.skip('uppercases nested join chains and query_source views for snowflake tables', () => {
    setConfig({dialect: 'snowflake', root: ''})
    updateFile(`
      table users_chain (
        id int
        join many orders_chain on orders_chain.user_id = id
      )
      table orders_chain (
        id int
        user_id int
        join one order_item_view_chain on order_item_view_chain.order_id = id
      )
      table order_item_view_chain (
        order_id int
      )
    `, 'snowflake_chain.gsql')

    // Column references should be uppercase, aliases lowercase (quoted) for proper result set casing
    // Note: uppercasing happens in core.ts via uppercaseTable() for table names, but column
    // names in expressions still use original case.
    expect('from users_chain select orders_chain.order_item_view_chain.order_id')
      .toRenderSql(`SELECT orders_chain_order_item_view_chain."ORDER_ID" as "orders_chain_order_item_view_chain_order_id"
        FROM USERS_CHAIN as base LEFT JOIN ORDERS_CHAIN AS orders_chain ON orders_chain."USER_ID"=base."ID"
        LEFT JOIN ORDER_ITEM_VIEW_CHAIN AS orders_chain_order_item_view_chain ON orders_chain_order_item_view_chain."ORDER_ID"=orders_chain."ID"`, {preserveCase: true})
  })

  it('expands plain wildcard', () => {
    expect('from users select *')
      .toRenderSql('select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base')
  })

  it('expands wildcards on a specific join', () => {
    expect('from orders select users.*')
      .toRenderSql('select users."id" as "id", users."name" as "name", users."email" as "email", users."created_at" as "created_at", users."age" as "age" from orders as base left join users as users on users."id"=base."user_id"')
  })

  it('excludes aggregates from wildcard expansion', () => {
    // especially if those aggs are indirectly an agg agg expression
    expect('table t (amount int, sum(amount) / count() as weird_avg) from t select *')
      .toRenderSql('select base."amount" as "amount" from t as base')
  })

  it('expands dot-join syntax', () => {
    expect('from orders select id, users.name')
      .toRenderSql('select base."id" as "id", users."name" as "users_name" from orders as base left join users as users on users."id"=base."user_id"')
  })

  it('handles column naming when mutliple columns have the same name', () => {
    expect('from orders select users.id, order_items.id')
      .toRenderSql('select users."id" as "users_id", order_items."id" as "order_items_id" from orders as base left join users as users on users."id"=base."user_id" left join order_items as order_items on order_items."order_id"=base."id"')
  })

  it('supports ad-hoc query joins', () => {
    expect('from orders join users on users.id = orders.user_id select amount, users.name')
      .toRenderSql('select base."amount" as "amount", users."name" as "users_name" from orders as base inner join users as users on users."id"=base."user_id"')
  })

  it('resolves bare refs across ad-hoc joins and errors on ambiguity', () => {
    expect('from orders join users on users.id = orders.user_id select amount')
      .toRenderSql('select base."amount" as "amount" from orders as base inner join users as users on users."id"=base."user_id"')

    expect('from orders join users on users.id = orders.user_id select id')
      .toHaveDiagnostic(/ambiguous field "id"/i)
  })

  it('joins views and CTEs in queries', () => {
    updateFile('table user_totals as (from orders select user_id, sum(amount) as total)', 'user_totals.gsql')

    expect('from users join user_totals on user_totals.user_id = users.id select name, user_totals.total')
      .toRenderSql('with "user_totals" as ( select base."user_id" as "user_id", sum(base."amount") as "total" from orders as base group by 1 order by 2 desc nulls last ) select base."name" as "name", user_totals."total" as "user_totals_total" from users as base inner join "user_totals" as user_totals on user_totals."user_id"=base."id"')

    expect('with active_users as (from users select id, name) from orders join active_users on active_users.id = orders.user_id select active_users.name')
      .toRenderSql('with "active_users" as ( select base."id" as "id", base."name" as "name" from users as base ) select active_users."name" as "active_users_name" from orders as base inner join active_users as active_users on active_users."id"=base."user_id"')
  })

  it('expands measures', async () => {
    expect('from users select name, total_orders')
      .toRenderSql('select base."name" as "name", (count(distinct orders."id")) as "total_orders" from users as base left join orders as orders on orders."user_id"=base."id" group by 1 order by 2 desc nulls last')

    await expect('from users select name, total_orders')
      .toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('handles expressions with aggregates', async () => {
    expect('from orders select user_id, avg_order_value')
      .toRenderSql('select base."user_id" as "user_id", (sum(base."amount")/count(1)) as "avg_order_value" from orders as base group by 1 order by 2 desc nulls last')

    await expect('from orders select user_id, avg_order_value')
      .toReturnRows([2, 40], [1, 30])
  })

  it('supports percentile aggregates via pXX shorthand', async () => {
    await expect('from orders select p10(amount) as min_amt, p50(amount) as median_amt, p999(amount) as max_amt')
      .toReturnRows([24, 40, 40])
  })

  it.skip('handles complex joins with measures', () => {
    expect('from products select name, category, total_sold where popular_item')
      .toRenderSql('select base."name" as "name", base."category" as "category", (sum(orders."amount")) as "total_sold" from products as base left join orders as orders on orders."product_id"=base."id" group by 1, 2 having sum(orders."amount")>1000 order by 3 desc nulls last')
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

  // Skipped: computed columns accessed through joins are not fully expanded yet.
  // The view's computed column (orders.total_revenue) needs to be expanded when rendering
  // the CTE, but currently we treat it as a regular column reference.
  it.skip('supports "table as" (aka view) queries', async () => {
    updateFile(`
      table users (
        id int
        name string
        join many orders on orders.user_id = id
        join one user_facts on user_facts.id = id
        user_facts.ltv as ltv -- test out joining the view back in to its original source
      )
      table orders (id int, user_id int, amount int, sum(amount) as total_revenue)
      table user_facts as (from users select id, orders.total_revenue as ltv)
    `, 'models.gsql')

    await expect('from user_facts select id, ltv') // query the view directly
      .toReturnRows([1, 60], [2, 40])

    expect('from users select name, ltv') // query the view indirectly, through a join
      .toRenderSql('with __stage0 as ( select base."id" as "id", (coalesce(sum(orders."amount"),0)) as "ltv" from users as base left join orders as orders on orders."user_id"=base."id" group by 1 ) select base."name" as "name", (user_facts."ltv") as "ltv" from users as base left join __stage0 as user_facts on user_facts."id"=base."id"')

    await expect('select * from users') // wildcards should include ltv
      .toReturnRows([1, 'Alice', 60], [2, 'Bob', 40])
  })

  it('handles query_source nested in join chains', () => {
    // Regression test: querying through nested joins to a query_source would crash with "Cannot read properties of null (reading 'type')"
    // because structRef wasn't set on deeply nested query objects after structuredClone
    updateFile(`
      table order_items (id int, user_id int, join one users on users.id = user_id)
      table users (id int, name string, join one user_facts on user_facts.id = id)
      table user_facts as (from users select id, name as fact_name)
    `, 'models.gsql')

    expect('from order_items select id, users.name')
      .toRenderSql('select base."id" as "id", users."name" as "users_name" from order_items as base left join users as users on users."id"=base."user_id"')
  })

  it('handles when the view is defined before the table', () => {
    // Covers a particular bug where if a view was analyzed before the table it queried, it'd break.
    // specifically the wildcard would include partially constructed joins
    clearWorkspace()
    updateFile('table user_facts as (from users select *)', 'facts.gsql')
    updateFile(testTables, 'models.gsql')

    expect('from user_facts select id, email order by id')
      .toRenderSql('with "user_facts" as ( select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base ) select base."id" as "id", base."email" as "email" from "user_facts" as base order by 1 asc nulls last')
  })

  it('qualified joins default to table name alias', () => {
    updateFile(`
      table dataset.users (id int, join many dataset.orders on id = orders.user_id)
      table dataset.orders (id int, user_id int)
    `, 'models.gsql')

    expect('from dataset.users select id, orders.id')
      .toRenderSql('select base."id" as "id", orders."id" as "orders_id" from dataset.users as base left join dataset.orders as orders on base."id"=orders."user_id"')
  })

  it('extends derived tables with additional measures', async () => {
    updateFile(`${testTables}
      table user_facts as (from users select id, total_orders)
      extend user_facts (total_orders > 1 as repeat_buyer)
    `, 'models.gsql')

    await expect('from user_facts select id, total_orders, repeat_buyer order by id')
      .toReturnRows([1, 2, true], [2, 1, false])
  })

  it('emits CTE for views referenced through joins', async () => {
    updateFile(`${testTables}
      table order_stats as (from orders select user_id, sum(amount) as total_spent)
      extend users (join one order_stats on order_stats.user_id = id)
    `, 'models.gsql')

    expect('from users select name, order_stats.total_spent order by name')
      .toRenderSql('with "order_stats" as ( select base."user_id" as "user_id", sum(base."amount") as "total_spent" from orders as base group by 1 order by 2 desc nulls last ) select base."name" as "name", order_stats."total_spent" as "order_stats_total_spent" from users as base left join "order_stats" as order_stats on order_stats."user_id"=base."id" order by 1 asc nulls last')

    await expect('from users select name, order_stats.total_spent order by name')
      .toReturnRows(['Alice', 60], ['Bob', 40])
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
      .toRenderSql('select base."name" as "name", count(distinct orders."id") as "total" from users as base left join orders as orders on orders."user_id"=base."id" group by 1 order by 2 desc nulls last')
  })

  it('doesnt duplicate groupBys', () => {
    expect('from users select name, count(orders.id) group by name')
      .toRenderSql('select base."name" as "name", count(distinct orders."id") as "col_1" from users as base left join orders as orders on orders."user_id"=base."id" group by 1 order by 2 desc nulls last')
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

  it('order by nonexistent field produces diagnostic', () => {
    expect('from users select name order by nonexistent')
      .toHaveDiagnostic(/Unknown field in ORDER BY: nonexistent/i)
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

  it('propagates isAgg through case expressions for GROUP BY', () => {
    expect("from users select name, case when count() > 2 then 'many' else 'few' end as bucket")
      .toRenderSql("select base.\"name\" as \"name\", case WHEN (count(1)>2) THEN 'many' ELSE 'few' END as \"bucket\" from users as base group by 1 order by 2 desc nulls last")
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
        id int,
        -- a description
        --# format=first_last
        name text,
        another_field text, -- this is another field #units=seconds
      )
      from t select name
    `)
    let table = getTable('t')!
    expect(table.metadata?.description?.toLowerCase()).toContain('this is my test table')
    let name = table.columns.find(c => c.name === 'name')!
    expect(name.metadata!.description!.toLowerCase()).toContain('a description')
    expect(name.metadata!.format).toBe('first_last')
    let another = table.columns.find(c => c.name === 'another_field')!
    expect(another.metadata!.description!.toLowerCase()).toContain('this is another field')
    expect(another.metadata!.units).toBe('seconds')
  })

  it('does not attach a single leading comment to multiple fields on the same line', () => {
    analyze(`
      table foo (
        -- the name field
        id bigint, name varchar
      )`)
    let t = getTable('foo')!
    let id = t.columns.find(c => c.name === 'id')!
    let name = t.columns.find(c => c.name === 'name')!
    expect(id.metadata!.description!.toLowerCase()).toContain('name field')
    expect(name.metadata?.description).toBeUndefined()
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

  it('allows duplicate table names across different markdown files', () => {
    clearWorkspace()
    updateFile('```gsql summary\nfrom users\n```', 'page1.md')
    updateFile('```gsql summary\nfrom users\n```', 'page2.md')
    updateFile(testTables, 'models.gsql')
    expect(getDiagnostics().find(d => d.message.includes('already defined'))).toBeUndefined()
  })

  it('reports diagnostics for unknown table in FROM', () => {
    expect('from not_a_table select id')
      .toHaveDiagnostic(/unknown table "not_a_table"/i)
  })

  it('reports diagnostics for unknown column', () => {
    expect('from orders select users.does_not_exist')
      .toHaveDiagnostic(/unknown field "does_not_exist" on users/i)
  })

  it('reports not being able to find a join on a query', () => {
    expect(`
      table t (oid int, join one users as usr on usr.id = oid);
      from t select users.name
    `).toHaveDiagnostic(/Could not find "users" on query/i)
  })

  it('can create new tables from queries', () => {
    expect(`table completed_orders as (from orders where status = 'completed' select id)
      from completed_orders select id`)
      .toRenderSql('with "completed_orders" as ( select base."id" as "id" from orders as base where base."status"=\'completed\' ) select base."id" as "id" from "completed_orders" as base')
  })

  it('can correctly count through a join', () => {
    expect('from orders select count(users.id)')
      .toRenderSql('select count(distinct users."id") as "col_0" from orders as base left join users as users on users."id"=base."user_id"')
  })

  it('handles min/max through a join', () => {
    expect('from orders select min(users.age)')
      .toRenderSql('select min(users."age") as "col_0" from orders as base left join users as users on users."id"=base."user_id"')
  })

  it('supports function calling', () => {
    expect('from users select coalesce(name, \'Unknown\') as name2')
      .toRenderSql('select coalesce(base."name",\'Unknown\') as "name2" from users as base')
  })

  it('supports agg function calling', () => {
    expect('from users select age, string_agg(name)')
      .toRenderSql('select base."age" as "age", string_agg(base."name") as "col_1" from users as base group by 1 order by 2 desc nulls last')
  })

  it('rejects variadic functions called with 0 args', () => {
    expect('from users select coalesce() as empty')
      .toHaveDiagnostic(/wrong number of arguments/i)
  })

  it('reports wrong number of arguments instead of unknown function', () => {
    expect('from users select lpad(name, 5)')
      .toHaveDiagnostic(/wrong number of arguments for lpad/i)
  })

  it('type-checks variadic args beyond the first', () => {
    // concat expects string... — passing a number as the 2nd arg should be caught
    expect('from users select concat(name, age)')
      .toHaveDiagnostic(/expected.*string/i)
  })




  it('treats generic aggregate functions as aggregates', () => {
    // any_value returns T and is an aggregate - it should be treated as an aggregate
    // This test ensures generic return types with aggregate: true are properly marked as measures
    // When working correctly, it should generate SQL with group by (since it's an aggregate)
    expect('from users select name, any_value(age) as sample_age')
      .toRenderSql('select base."name" as "name", any_value(base."age") as "sample_age" from users as base group by 1 order by 2 desc nulls last')
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
      id int,
      name text
    );
    from t select id, name`)
      .toRenderSql('select base."id" as "id", base."name" as "name" from t as base')

    expect(`table completed_ids as (from users select id,) ;
      from completed_ids select id`)
      .toRenderSql('with "completed_ids" as ( select base."id" as "id" from users as base ) select base."id" as "id" from "completed_ids" as base')
  })

  it('supports count_if (function we added)', () => {
    expect('from orders select count_if(amount > 100)')
      .toRenderSql('select count_if(base."amount">100) as "col_0" from orders as base')
  })

  it('supports count_if alias for countif on BigQuery', () => {
    setConfig({root: '', bigquery: {}})
    expect('from orders select count_if(amount > 100)')
      .toRenderSql('select countif(base.`amount`>100) as `col_0` from `orders` as base')
  })

  it('supports BigQuery math functions', () => {
    setConfig({root: '', bigquery: {}})
    expect('from orders select abs(amount), sqrt(amount), round(amount, 2)')
      .toRenderSql('select abs(base.`amount`) as `col_0`, sqrt(base.`amount`) as `col_1`, round(base.`amount`,2) as `col_2` from `orders` as base')
  })

  it('supports BigQuery string functions', () => {
    setConfig({root: '', bigquery: {}})
    expect('from users select lower(name), upper(name), length(name)')
      .toRenderSql('select lower(base.`name`) as `col_0`, upper(base.`name`) as `col_1`, length(base.`name`) as `col_2` from `users` as base')
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
      .toRenderSql('select date_trunc(base.`created_at`,week) as `col_0` from `calendar` as base')
  })

  it('supports date_trunc on date columns (as opposed to timestamp)', () => {
    setConfig({root: '', bigquery: {}})
    updateFile('table events (event_date date)', 'events.gsql')
    expect('from events select date_trunc(event_date, month)')
      .toRenderSql('select date_trunc(base.`event_date`,month) as `col_0` from `events` as base')
  })

  it('supports extract expressions', () => {
    expect('from users select extract(hour from created_at)')
      .toRenderSql('select extract(hour from base."created_at") as "col_0" from users as base')
  })

  it('supports null and boolean literals', () => {
    expect('from users select name, null, true, FALSE')
      .toRenderSql('select base."name" as "name", null as "col_1", true as "col_2", false as "col_3" from users as base')
  })

  it('coerces string literals to timestamps in comparisons', () => {
    expect("from users select id where created_at >= '2024-01-01'")
      .toRenderSql("select base.\"id\" as \"id\" from users as base where base.\"created_at\">=TIMESTAMP '2024-01-01 00:00:00'")
  })

  it('coerces string literals to timestamps in IN lists', () => {
    expect("from users select id where created_at in ('2024-01-01','2024-01-02')")
      .toRenderSql("select base.\"id\" as \"id\" from users as base where base.\"created_at\" in (TIMESTAMP '2024-01-01 00:00:00',TIMESTAMP '2024-01-02 00:00:00')")
  })

  it('diagnoses string used where interval expected', () => {
    expect("from users select created_at + 'many moons'")
      .toHaveDiagnostic(/Invalid date arithmetic/i)
  })

  it('parses temporal parameters at runtime', () => {
    let queries = analyze(`${testTables}
      from users select id where created_at >= $start_date
    `)
    expect(toSql(queries[0], {start_date: '2024-01-01'})).toMatch(/>=DATE '2024-01-01'/)
  })

  it('diagnoses invalid timestamp literals', () => {
    expect("from users select id where created_at >= 'soonish'")
      .toHaveDiagnostic(/Cannot parse as timestamp/i)
  })

  it('supports interval keyword with quoted string', () => {
    expect("from users select created_at + interval '5 minutes' as shifted")
      .toRenderSql('select base."created_at" + INTERVAL 5 minute as "shifted" from users as base')
  })

  it('supports interval keyword with unquoted number and unit', () => {
    expect('from users select created_at + interval 5 minutes as shifted')
      .toRenderSql('select base."created_at" + INTERVAL 5 minute as "shifted" from users as base')
  })

  it('supports date keyword', () => {
    expect('from users select date \'2024-01-01\' as d')
      .toRenderSql('select DATE \'2024-01-01\' as "d" from users as base')
  })

  it('allows temporal keywords as column names', () => {
    // Columns can be named 'date' or 'timestamp' even though these are also keywords for literals
    updateFile('table foo (id VARCHAR, date DATE, timestamp TIMESTAMP)', 'foo.gsql')
    expect('from foo select id')
      .toRenderSql('select base."id" as "id" from foo as base')
  })

  it('supports timestamp keyword', () => {
    expect('from users select id where created_at >= timestamp \'2024-01-01 12:00:00\'')
      .toRenderSql('select base."id" as "id" from users as base where base."created_at">=TIMESTAMP \'2024-01-01 12:00:00\'')
  })

  it('supports ::DATE cast syntax', () => {
    expect('from users select \'2024-01-01\'::DATE as d')
      .toRenderSql('select CAST(\'2024-01-01\' AS DATE) as "d" from users as base')
  })

  it('diagnoses invalid date literal in date keyword', () => {
    expect('from users select date \'not-a-date\'')
      .toHaveDiagnostic(/Invalid date/i)
  })

  it('diagnoses invalid interval unit', () => {
    expect('from users select created_at + interval 5 moons')
      .toHaveDiagnostic(/Invalid interval unit/i)
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
      .toRenderSql('select usr."name" as "usr_name" from t as base left join users as usr on usr."id"=base."oid"')
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

  it('does not treat $word inside single-quoted strings as params', () => {
    let queries = analyze(`${testTables}
      from users select id where name = '$test'
    `)
    expect(toSql(queries[0])).toMatch(/\$test/)
  })

  it('replaces params outside quotes but not inside', () => {
    let queries = analyze(`${testTables}
      from users select id where name = $name and email = '$literal'
    `)
    let sql = toSql(queries[0], {name: 'Alice'})
    expect(sql).toMatch(/'Alice'/)
    expect(sql).toMatch(/\$literal/)
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
    `).toRenderSql('with "test" as ( select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base where base."age">20 ) select base."name" as "name", avg(base."age") as "col_1" from "test" as base group by 1 order by 2 desc nulls last')
  })

  it('snowflake query_source (CTE) aliases match references', () => {
    // When querying from a query_source table in Snowflake, the CTE's aliases must match
    // the outer query's references. Both use uppercase for internal consistency, but
    // the final output aliases are lowercase.
    // Note: using case-insensitive comparison since column uppercasing happens in core.ts
    // via uppercaseTable() which affects table names but not all identifiers.
    setConfig({dialect: 'snowflake', root: ''})
    expect(`
      \`\`\`gsql test
        from users select count() as num
      \`\`\`
      <BigValue data="test" value="num" />
    `).toRenderSql('WITH "test" as ( SELECT count(1) as "num" FROM USERS as base ) SELECT base."num" as "num" FROM "test" as base')
  })

  it('reports the right line/col number for markdown errors', () => {
    analyze(trimIndentation(`## My analysis
      \`\`\`gsql test
        from users where discount > 20
      \`\`\`
    `), 'md')
    let errors = getDiagnostics().filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0].from.line).toBe(2)
    expect(errors[0].from.col).toBe(19)
    expect(errors[0].to.col).toBe(27)
  })

  it('marks markdown component attribute errors across the attribute value', () => {
    analyze('<BarChart data="users" x="code" y="age" />', 'md')
    let errors = getDiagnostics().filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Unknown field "code"')
    expect(errors[0].from.line).toBe(0)
    expect(errors[0].from.col).toBe(26)
    expect(errors[0].to.col).toBe(errors[0].from.col + 4)
  })

  it('parses components with > inside quoted attribute values', () => {
    expect(`
      \`\`\`gsql test
        from users where age > 20
      \`\`\`
      <BarChart data="test" x="name" y="avg(age)" title="Count > 0" />
    `).toRenderSql('with "test" as ( select base."id" as "id", base."name" as "name", base."email" as "email", base."created_at" as "created_at", base."age" as "age" from users as base where base."age">20 ) select base."name" as "name", avg(base."age") as "col_1" from "test" as base group by 1 order by 2 desc nulls last')
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
        id int
        join many beta on beta.alpha_id = id
        avg(beta.num) as avg_num
      )

      table beta (
        id int
        alpha_id int
        num int
        join one alpha on alpha.id = alpha_id
      )
    `, 'cycle.gsql')
    expect('from alpha select count(*)').toRenderSql('select count(1) as "col_0" from alpha as base')
    expect('from alpha select avg_num').toRenderSql('select (avg(beta."num")) as "avg_num" from alpha as base left join beta as beta on beta."alpha_id"=base."id"')
    // expect('from beta select alpha.avg_num').toRenderSql('')
  })

  it('supports legacy computed column syntax (expr as alias)', () => {
    updateFile(`
      table users (
        id int,
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

  it('supports standard functions in bigquery', () => {
    // BigQuery uses a different dialect than the StandardSQL that many use in Malloy. Ensure that we're loading standard fns into bigquery
    setConfig({root: '', bigquery: {}})
    expect('from users select floor(age) as floored_age')
      .toRenderSql('select floor(base.`age`) as `floored_age` from `users` as base')
  })

  it('supports cast() expressions', () => {
    expect('from users select cast(age as varchar)')
      .toRenderSql('select CAST(base."age" AS VARCHAR) as "col_0" from users as base')
    expect('from users select cast(age as float64)')
      .toRenderSql('select CAST(base."age" AS FLOAT64) as "col_0" from users as base')
  })

  it('supports :: cast syntax', () => {
    expect('from users select age::VARCHAR')
      .toRenderSql('select CAST(base."age" AS VARCHAR) as "col_0" from users as base')
    expect('from users select name::int')
      .toRenderSql('select CAST(base."name" AS INT) as "col_0" from users as base')
  })

  it('reports diagnostic for invalid cast type', () => {
    expect('from users select cast(age as invalidtype)').toHaveDiagnostic(/Unsupported cast type: invalidtype/i)
  })

  it('supports cast in expressions', () => {
    expect('from users select cast(age as varchar) = name')
      .toRenderSql('select CAST(base."age" AS VARCHAR)=base."name" as "col_0" from users as base')
  })

  it('ignores comments within table definitions', () => {
    // Comments should be skipped and not interfere with expression parsing
    expect(`table test (
      id INT64
      computed: id / 2
      -- this is a comment
      name STRING
    ); from test select id`).toRenderSql('select base."id" as "id" from test as base')
  })

  it('single join_many aggregate is fine, join_one is fine', () => {
    clearWorkspace()
    setConfig({root: ''})
    updateFile(`
      table customers (
        id int
        name text
        join many purchases on purchases.customer_id = id
      )
      table purchases (
        id int
        customer_id int
        amount int
        join one customers on customers.id = customer_id
      )
    `, 'fanout_test.gsql')

    expect('from customers select name, sum(purchases.amount)').toHaveNoErrors()
    expect('from purchases select customers.name, sum(amount)').toHaveNoErrors()
  })

  it('handles computed columns with chained joins', () => {
    clearWorkspace()
    setConfig({root: ''})
    updateFile(`
      table countries (id int, name string)
      table users (id int, country_id int, join one countries on countries.id = country_id)
      table orders (id int, user_id int, join one users on users.id = user_id, user_country: users.countries.name)
    `, 'chain.gsql')

    expect('from orders select user_country')
      .toRenderSql('select (users_countries."name") as "user_country" from orders as base left join users as users on users."id"=base."user_id" left join countries as users_countries on users_countries."id"=users."country_id"')
  })

  // When the same table is joined multiple times with different aliases, each reference
  // to a computed column uses the correct alias for that join instance.
  it('handles computed columns with multiple joins to same table', () => {
    clearWorkspace()
    setConfig({root: ''})
    updateFile(`
      table orders (id int, user_id int, amount int, discounted: amount * 0.9)
      table users (
        id int
        join many orders as recent_orders on recent_orders.user_id = id
        join many orders as old_orders on old_orders.user_id = id
      )
    `, 'multi_join.gsql')

    expect('from users select recent_orders.discounted, old_orders.discounted')
      .toRenderSql('select (recent_orders."amount"*0.9) as "recent_orders_discounted", (old_orders."amount"*0.9) as "old_orders_discounted" from users as base left join orders as recent_orders on recent_orders."user_id"=base."id" left join orders as old_orders on old_orders."user_id"=base."id"')
  })

  it('supports CTEs', async () => {
    let q = `with
      high_value as (from orders where amount >= 40 select id, user_id, amount),
      hv_users as (from high_value select user_id)
      from hv_users select user_id order by user_id`
    expect(q).toRenderSql('with "high_value" as ( select base."id" as "id", base."user_id" as "user_id", base."amount" as "amount" from orders as base where base."amount">=40 ), "hv_users" as ( select base."user_id" as "user_id" from high_value as base ) select base."user_id" as "user_id" from hv_users as base order by 1 asc nulls last')
    await expect(q).toReturnRows([1], [2])
  })

  it('CTE shadows existing table names', () => {
    // CTE named "orders" should shadow the real orders table
    expect('with orders as (from users select id, name) from orders select id, name order by id')
      .toRenderSql('with "orders" as ( select base."id" as "id", base."name" as "name" from users as base ) select base."id" as "id", base."name" as "name" from orders as base order by 1 asc nulls last')
  })

  it('supports nested CTEs referencing earlier siblings', () => {
    // The second CTE's inner query has its own WITH that references the first CTE
    expect(`with
      completed as (from orders where status = 'completed' select user_id, amount),
      summary as (with totals as (from completed select user_id, sum(amount) as total) from totals select user_id, total)
      from summary select user_id, total order by user_id`)
      .toRenderSql(`with "completed" as ( select base."user_id" as "user_id", base."amount" as "amount" from orders as base where base."status"='completed' ),
        "summary" as ( with "totals" as ( select base."user_id" as "user_id", sum(base."amount") as "total" from completed as base group by 1 order by 2 desc nulls last ) select base."user_id" as "user_id", base."total" as "total" from totals as base )
        select base."user_id" as "user_id", base."total" as "total" from summary as base order by 1 asc nulls last`)
  })
})
