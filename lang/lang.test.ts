import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect} from 'vitest'

/// <reference types="vitest/globals" />
import {setGlobalConfig} from './config.ts'
import {toSql} from './core.ts'
import {prepareEcommerceTables, clearWorkspace, getTable, analyze, getDiagnostics, updateFile, loadWorkspace, getFile} from './testHelpers.ts'
import {formatType, parseWarehouseFieldType} from './types.ts'
import {trimIndentation} from './util.ts'

const testTables = `
  table users (
    id int
    name text
    -- email address of the user
    #pii
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
    setGlobalConfig({root: ''})
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
    expect('from users select id, name where id = 1').toRenderSql('SELECT users.id as id, users.name as name from users as users WHERE users.id=1')
    await expect('from users select id, name where id = 1').toReturnRows([1, 'Alice'])
  })

  it('handles select 1 without from', async () => {
    expect('select 1').toRenderSql('SELECT 1 as col_0')
    await expect('select 1').toReturnRows([1])
  })

  it('supports union and union all', async () => {
    expect('select 1 as id union select 1 as id').toRenderSql('SELECT 1 as id UNION SELECT 1 as id')
    await expect('select 1 as id union select 1 as id').toReturnRows([1])

    expect('select 1 as id union all select 1 as id').toRenderSql('SELECT 1 as id UNION ALL SELECT 1 as id')
    await expect('select 1 as id union all select 1 as id').toReturnRows([1], [1])
  })

  it('supports intersect and except', async () => {
    expect('select 1 as id intersect select 1 as id').toRenderSql('SELECT 1 as id INTERSECT SELECT 1 as id')
    await expect('select 1 as id intersect select 1 as id').toReturnRows([1])

    expect('select 1 as id except select 2 as id').toRenderSql('SELECT 1 as id EXCEPT SELECT 2 as id')
    await expect('select 1 as id except select 2 as id').toReturnRows([1])
  })

  it('supports set operations over analyzed queries', async () => {
    expect('from users select id union from orders select user_id as id').toRenderSql('SELECT users.id as id FROM users as users UNION SELECT orders.user_id as id FROM orders as orders')
    await expect('from users select id union all from orders select user_id as id').toReturnRows([1], [2], [1], [1], [2])
  })

  it('suppresses implicit branch order by for aggregate set operations', () => {
    expect(`
      from users select name as label, sum(payments.amount) as amt
      union all
      from users select email as label, sum(payments.amount) as amt
    `).toRenderSql(
      'SELECT users.name as label, sum(payments.amount) as amt FROM users as users LEFT JOIN payments as payments ON payments.user_id=users.id GROUP BY 1 UNION ALL SELECT users.email as label, sum(payments.amount) as amt FROM users as users LEFT JOIN payments as payments ON payments.user_id=users.id GROUP BY 1',
    )
  })

  it('keeps implicit order by for standalone aggregate queries', () => {
    expect('from users select name as label, sum(payments.amount) as amt').toRenderSql(
      'SELECT users.name as label, sum(payments.amount) as amt FROM users as users LEFT JOIN payments as payments ON payments.user_id=users.id GROUP BY 1 ORDER BY 2 desc NULLS LAST',
    )
  })

  it('preserves implicit order by inside parenthesized set operands', () => {
    expect(`
      from users select name as label, sum(payments.amount) as amt
      union all
      (from users select email as label, sum(payments.amount) as amt)
    `).toRenderSql(
      'SELECT users.name as label, sum(payments.amount) as amt FROM users as users LEFT JOIN payments as payments ON payments.user_id=users.id GROUP BY 1 UNION ALL ( SELECT users.email as label, sum(payments.amount) as amt FROM users as users LEFT JOIN payments as payments ON payments.user_id=users.id GROUP BY 1 ORDER BY 2 desc NULLS LAST )',
    )
  })

  it('supports parenthesized set-operation operands in subqueries and ctes', () => {
    expect('from (select 1 as id union all select 2 as id) nums select id').toRenderSql('SELECT nums.id as id FROM ( SELECT 1 as id UNION ALL SELECT 2 as id ) as nums')

    expect('with nums as (select 1 as id union all select 2 as id) from nums select id').toRenderSql('WITH nums as ( SELECT 1 as id UNION ALL SELECT 2 as id ) SELECT nums.id as id FROM nums as nums')
  })

  it('applies outer order by and limit to the full set operation', () => {
    expect('select 2 as id union select 1 as id order by id limit 1').toRenderSql('SELECT 2 as id UNION SELECT 1 as id ORDER BY 1 asc NULLS LAST LIMIT 1')
  })

  it('executes aggregate set operations with an outer order by', async () => {
    await expect(`
      from users select 'name:' || name as label, sum(payments.amount) as amt
      union all
      from users select 'email:' || email as label, sum(payments.amount) as amt
      order by label
    `).toReturnRows(['email:alice@example.com', 100], ['email:bob@example.com', 50], ['name:Alice', 100], ['name:Bob', 50])
  })

  it('requires matching column counts across set-operation branches', () => {
    expect('select 1 as id union select 1 as id, 2 as other').toHaveDiagnostic(/same number of columns/i)
  })

  it('renders unquoted identifiers for snowflake queries', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect('from users select id, orders.amount as amt order by amt desc').toRenderSql(
      'SELECT users.id as id, orders.amount as amt FROM USERS as users LEFT JOIN ORDERS as orders ON orders.user_id=users.id ORDER BY 2 desc NULLS LAST',
    )
  })

  it('applies defaultNamespace to unqualified table paths', () => {
    setGlobalConfig({root: '', defaultNamespace: 'analytics'})
    expect('from users select id').toRenderSql('select users.id as id from analytics.users as users')
  })

  it('does not apply defaultNamespace to already-qualified table paths', () => {
    setGlobalConfig({root: '', defaultNamespace: 'analytics'})
    updateFile('table raw.users (id int)', 'namespaced.gsql')
    expect('from raw.users select id').toRenderSql('select users.id as id from raw.users as users')
  })

  it('applies defaultNamespace to unqualified table paths for clickhouse', () => {
    setGlobalConfig({dialect: 'clickhouse', root: '', defaultNamespace: 'default'})
    updateFile('table nyc_taxi (trip_id int)', 'clickhouse.gsql')
    expect('from nyc_taxi select trip_id').toRenderSql('SELECT nyc_taxi.trip_id as trip_id FROM default.nyc_taxi as nyc_taxi')
  })

  it('excludes agents.md from workspace by default', async () => {
    let root = path.join(import.meta.dirname, '../examples/flights')
    clearWorkspace()
    setGlobalConfig({root})
    await loadWorkspace(root, true)
    expect(getFile('AGENTS.md')).toBeUndefined()
  })

  it('ignores workspace files matched by ignoredFiles globs', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-workspace-ignore-'))

    try {
      await writeFile(path.join(root, 'models.gsql'), 'table users (id int)')
      await mkdir(path.join(root, 'nested'), {recursive: true})
      await writeFile(path.join(root, 'nested', 'agents.md'), '# hidden nav page')
      await mkdir(path.join(root, 'dist'), {recursive: true})
      await writeFile(path.join(root, 'dist', 'ignored.gsql'), 'table hidden (id int)')

      clearWorkspace()
      setGlobalConfig({root, ignoredFiles: ['**/agents.md', 'dist/**']})
      await loadWorkspace(root, true)

      expect(getFile('models.gsql')).toBeDefined()
      expect(getFile('nested/agents.md')).toBeUndefined()
      expect(getFile('dist/ignored.gsql')).toBeUndefined()
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  // Skipped: this test has issues with join chain resolution that are unrelated to uppercase handling
  // The SQL output doesn't match expectations for nested joins through snowflake tables
  it.skip('uppercases nested join chains and query_source views for snowflake tables', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    updateFile(
      `
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
    `,
      'snowflake_chain.gsql',
    )

    // Snowflake table paths are uppercased by dialect formatting, while select aliases remain as authored.
    // Note: this skipped test documents nested join-chain behavior that may diverge from current defaults.
    expect('from users_chain select orders_chain.order_item_view_chain.order_id').toRenderSql(
      `SELECT orders_chain_order_item_view_chain.ORDER_ID as orders_chain_order_item_view_chain_order_id
        from USERS_CHAIN as USERS_CHAIN LEFT JOIN ORDERS_CHAIN AS orders_chain ON orders_chain.USER_ID=USERS_CHAIN.ID
        LEFT JOIN ORDER_ITEM_VIEW_CHAIN AS orders_chain_order_item_view_chain ON orders_chain_order_item_view_chain.ORDER_ID=orders_chain.ID`,
      {preserveCase: true},
    )
  })

  it('expands plain wildcard', () => {
    expect('from users select *').toRenderSql('select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from users as users')
  })

  it('expands plain wildcard when mixed with other select items', () => {
    expect('from users select *, email as contact').toRenderSql(
      'select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age, users.email as contact from users as users',
    )
  })

  it('expands wildcards on a specific join', () => {
    expect('from orders select users.*').toRenderSql(
      'select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from orders as orders left join users as users on users.id=orders.user_id',
    )
  })

  it('excludes aggregates from wildcard expansion', () => {
    // especially if those aggs are indirectly an agg agg expression
    expect('table t (amount int, sum(amount) / count() as weird_avg) from t select *').toRenderSql('select t.amount as amount from t as t')
  })

  it('expands dot-join syntax', () => {
    expect('from orders select id, users.name').toRenderSql('select orders.id as id, users.name as name from orders as orders left join users as users on users.id=orders.user_id')
  })

  it('handles column naming when mutliple columns have the same name', () => {
    expect('from orders select users.id, order_items.id').toRenderSql(
      'select users.id as users_id, order_items.id as order_items_id from orders as orders left join users as users on users.id=orders.user_id left join order_items as order_items on order_items.order_id=orders.id',
    )
  })

  it('supports ad-hoc query joins', () => {
    expect('from orders join users on users.id = orders.user_id select amount, users.name').toRenderSql(
      'select orders.amount as amount, users.name as name from orders as orders inner join users as users on users.id=orders.user_id',
    )
  })

  it('uses leaf names for unambiguous columns when joining aliased ctes', () => {
    let q = `
      with dep as (
        from orders
        select user_id as code, avg(amount) as dep_delay
      ),
      arr as (
        from payments
        select user_id as code, avg(amount) as arr_delay
      )
      select d.code, d.dep_delay, a.arr_delay
      from dep d inner join arr a on d.code = a.code
    `
    expect(q).toRenderSql(
      'with dep as ( select orders.user_id as code, avg(orders.amount) as dep_delay from orders as orders group by 1 order by 2 desc nulls last ), arr as ( select payments.user_id as code, avg(payments.amount) as arr_delay from payments as payments group by 1 order by 2 desc nulls last ) select d.code as code, d.dep_delay as dep_delay, a.arr_delay as arr_delay from dep as d inner join arr as a on d.code=a.code',
    )
    let [query] = analyze(q)
    expect(query.fields.map(field => field.name)).toEqual(['code', 'dep_delay', 'arr_delay'])
  })

  it('falls back to qualified names when inferred join columns collide', () => {
    let q = `
      with dep as (
        from orders
        select user_id as code, avg(amount) as dep_delay
      ),
      arr as (
        from payments
        select user_id as code, avg(amount) as arr_delay
      )
      select d.code, a.code
      from dep d inner join arr a on d.code = a.code
    `
    expect(q).toRenderSql(
      'with dep as ( select orders.user_id as code, avg(orders.amount) as dep_delay from orders as orders group by 1 order by 2 desc nulls last ), arr as ( select payments.user_id as code, avg(payments.amount) as arr_delay from payments as payments group by 1 order by 2 desc nulls last ) select d.code as d_code, a.code as a_code from dep as d inner join arr as a on d.code=a.code',
    )
    let [query] = analyze(q)
    expect(query.fields.map(field => field.name)).toEqual(['d_code', 'a_code'])
  })

  it('reports diagnostics for duplicate final output names', () => {
    expect('from orders join users on users.id = orders.user_id select amount as value, users.name as value').toHaveDiagnostic(/Duplicate output column name "value"/i)
  })

  it('supports cross join without an ON clause', () => {
    expect('from orders cross join users select amount, users.name').toRenderSql('select orders.amount as amount, users.name as name from orders as orders cross join users as users')
  })

  it('rejects cross join with an ON clause', () => {
    expect('from orders cross join users on users.id = orders.user_id select amount').toHaveDiagnostic(/cross join cannot have an on clause/i)
  })

  it('supports cross join unnest with scalar alias binding', async () => {
    let q = `
      table events (id int, tags array<string>)
      from events
      cross join unnest(tags) as tag
      select id, tag
      order by id, tag
    `
    expect(q).toRenderSql('select events.id as id, tag as tag from events as events cross join unnest(events.tags) as tag(tag) order by 1 asc nulls last,2 asc nulls last')
    await expect(q).toReturnRows([1, 'beta'], [1, 'vip'])
  })

  it('renders unnest per dialect', () => {
    let q = `
      table events (id int, tags array<string>)
      from events
      cross join unnest(tags) as tag
      select id, tag
    `

    setGlobalConfig({root: '', bigquery: {}})
    expect(q).toRenderSql('select events.id as id, tag as tag from `events` as events cross join unnest(events.tags) as tag')

    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect(q).toRenderSql('select events.id as id, tag.value as tag from EVENTS as events , TABLE(FLATTEN(INPUT => events.tags)) AS tag')

    setGlobalConfig({dialect: 'clickhouse', root: ''})
    expect(q).toRenderSql('SELECT events.id as id, tag as tag FROM events as events ARRAY JOIN events.tags AS tag')
  })

  it('rejects unsupported unnest join forms', () => {
    expect(`
      table events (id int, tags array<string>)
      from events
      join unnest(tags) as tag
      select id, tag
    `).toHaveDiagnostic(/bare join unnest is not supported/i)

    expect(`
      table events (id int, tags array<string>)
      from events
      inner join unnest(tags) as tag
      select id, tag
    `).toHaveDiagnostic(/inner join unnest is not supported/i)

    expect(`
      table events (id int, tags array<string>)
      from events
      left join unnest(tags) as tag
      select id, tag
    `).toHaveDiagnostic(/left join unnest is not supported/i)
  })

  it('requires array input for unnest', () => {
    expect(`
      table events (id int, tags array<string>)
      from events
      cross join unnest(id) as tag
      select tag
    `).toHaveDiagnostic(/unnest requires an array expression/i)
  })

  it('resolves bare refs across ad-hoc joins and errors on ambiguity', () => {
    expect('from orders join users on users.id = orders.user_id select amount').toRenderSql('select orders.amount as amount from orders as orders inner join users as users on users.id=orders.user_id')

    expect('from orders join users on users.id = orders.user_id select id').toHaveDiagnostic(/ambiguous field "id"/i)
  })

  it('joins views and CTEs in queries', () => {
    updateFile('table user_totals as (from orders select user_id, sum(amount) as total)', 'user_totals.gsql')

    expect('from users join user_totals on user_totals.user_id = users.id select name, user_totals.total').toRenderSql(
      'with user_totals as ( select orders.user_id as user_id, sum(orders.amount) as total from orders as orders group by 1 order by 2 desc nulls last ) select users.name as name, user_totals.total as total from users as users inner join user_totals as user_totals on user_totals.user_id=users.id',
    )

    expect('with active_users as (from users select id, name) from orders join active_users on active_users.id = orders.user_id select active_users.name').toRenderSql(
      'with active_users as ( select users.id as id, users.name as name from users as users ) select active_users.name as name from orders as orders inner join active_users as active_users on active_users.id=orders.user_id',
    )
  })

  it('expands measures', async () => {
    expect('from users select name, total_orders').toRenderSql(
      'select users.name as name, (count(distinct orders.id)) as total_orders from users as users left join orders as orders on orders.user_id=users.id group by 1 order by 2 desc nulls last',
    )

    await expect('from users select name, total_orders').toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('ignores output fields when analyzing computed columns', () => {
    updateFile(
      `table sales (
        amount int
        cost int
        revenue: sum(amount)
        cogs: sum(cost)
        gross_profit: revenue - cogs
      )`,
      'sales.gsql',
    )

    expect('from sales select revenue, gross_profit').toRenderSql('select (sum(sales.amount)) as revenue, ((sum(sales.amount))-(sum(sales.cost))) as gross_profit from sales as sales')
  })

  it('handles expressions with aggregates', async () => {
    expect('from orders select user_id, avg_order_value').toRenderSql(
      'select orders.user_id as user_id, (sum(orders.amount)/count(1)) as avg_order_value from orders as orders group by 1 order by 2 desc nulls last',
    )

    await expect('from orders select user_id, avg_order_value').toReturnRows([2, 40], [1, 30])
  })

  it('preserves parentheses in expressions for correct operator precedence', async () => {
    expect('from users select (age + age) / (age + age) as result').toRenderSql('select (users.age+users.age)/(users.age+users.age) as result from users as users')
    await expect('from users select (1 + 2) / (1 + 2) as result limit 1').toReturnRows([1])
  })

  it('supports || string concatenation', async () => {
    expect("from users select name || ' suffix' as result").toRenderSql("select users.name||' suffix' as result from users as users")
    await expect("from users select name || '!' as result limit 1").toReturnRows(['Alice!'])
  })

  it('reports type errors for || with non-string operands', () => {
    expect('from users select age || name as result').toHaveDiagnostic('Expected string, got number')
  })

  it('supports window expressions with partition, order, and frame clauses', () => {
    expect(`
      from orders
      select
        user_id,
        sum(amount) over (
          partition by user_id
          order by id
          rows between 1 preceding and current row
        ) as running_total
    `).toRenderSql(
      'select orders.user_id as user_id, sum(orders.amount) OVER (PARTITION BY orders.user_id ORDER BY orders.id ASC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) as running_total from orders as orders',
    )
  })

  it('supports window-only functions with over', () => {
    expect('from users select row_number() over (order by id) as rn').toRenderSql('select row_number() OVER (ORDER BY users.id ASC) as rn from users as users')
  })

  it('supports empty over clause', () => {
    expect('from users select row_number() over () as rn').toRenderSql('select row_number() OVER () as rn from users as users')
  })

  it('rejects over on scalar functions', () => {
    expect('from users select lower(name) over () as bad_window').toHaveDiagnostic(/only aggregate or window functions can use over/i)
  })

  it('does not treat windowed aggregates as query aggregates', () => {
    expect('from orders select id, sum(amount) over (order by id) as running_amount').toRenderSql(
      'select orders.id as id, sum(orders.amount) OVER (ORDER BY orders.id ASC) as running_amount from orders as orders',
    )
  })

  it('supports count(*) over partitioning', () => {
    expect('from orders select id, count(*) over (partition by user_id) as flights_per_user').toRenderSql(
      'select orders.id as id, count(1) OVER (PARTITION BY orders.user_id) as flights_per_user from orders as orders',
    )
  })

  it('supports range frame with unbounded following', () => {
    expect('from orders select id, sum(amount) over (order by id range between current row and unbounded following) as tail_sum').toRenderSql(
      'select orders.id as id, sum(orders.amount) OVER (ORDER BY orders.id ASC RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) as tail_sum from orders as orders',
    )
  })

  it('executes lag window functions correctly', async () => {
    await expect(`
      from orders
      select
        id,
        amount,
        lag(amount, 1, 0) over (order by id) as prev_amount
      order by 1
    `).toReturnRows([100, 20, 0], [101, 40, 20], [102, 40, 40])
  })

  it('preserves parentheses in measure composition', () => {
    updateFile(
      `table orders (
      id int, user_id int, amount int, status text
      join one users on users.id = user_id
      join many order_items on order_items.order_id = id
      total_revenue: sum(amount)
      avg_order_value: sum(amount) / count()
      completed: status = 'completed'
      rate: (total_revenue + avg_order_value) / (total_revenue + avg_order_value)
    )`,
      'models.gsql',
    )
    expect('from orders select rate').toRenderSql('select (((sum(orders.amount))+(sum(orders.amount)/count(1)))/((sum(orders.amount))+(sum(orders.amount)/count(1)))) as rate from orders as orders')
  })

  it('supports percentile aggregates via pXX shorthand', async () => {
    await expect('from orders select p10(amount) as min_amt, p50(amount) as median_amt, p999(amount) as max_amt').toReturnRows([24, 40, 40])
  })

  it('supports pXX over empty window', () => {
    expect('from orders select id, p50(amount) over () as p50_all order by id').toRenderSql(
      'select orders.id as id, quantile_cont(orders.amount, 0.5) OVER () as p50_all from orders as orders order by 1 asc nulls last',
    )
  })

  it('supports pXX over partition windows', () => {
    expect('from orders select id, p50(amount) over (partition by user_id) as p50_by_user order by id').toRenderSql(
      'select orders.id as id, quantile_cont(orders.amount, 0.5) OVER (PARTITION BY orders.user_id) as p50_by_user from orders as orders order by 1 asc nulls last',
    )
  })

  it('does not treat windowed pXX as query aggregates', () => {
    expect('from orders select id, p50(amount) over (partition by user_id) as p50_by_user').toRenderSql(
      'select orders.id as id, quantile_cont(orders.amount, 0.5) OVER (PARTITION BY orders.user_id) as p50_by_user from orders as orders',
    )
  })

  it('rejects pXX window ordering in v1', () => {
    expect('from orders select p50(amount) over (order by id) as bad').toHaveDiagnostic(/pxx window form currently supports partition by only/i)
  })

  it('rejects pXX window frame clauses in v1', () => {
    expect('from orders select p50(amount) over (partition by user_id rows between 1 preceding and current row) as bad').toHaveDiagnostic(/pxx window form currently supports partition by only/i)
  })

  it('executes partitioned pXX windows correctly in duckdb', async () => {
    await expect(`
      from orders
      select
        id,
        user_id,
        p50(amount) over (partition by user_id) as p50_by_user
      order by id
    `).toReturnRows([100, 1, 30], [101, 1, 30], [102, 2, 40])
  })

  it('keeps pXX guardrails with windows', () => {
    expect('from orders select p0(amount) over (partition by user_id)').toHaveDiagnostic(/p0 is not allowed/i)
    expect('from orders select p100(amount) over (partition by user_id)').toHaveDiagnostic(/p100 is not allowed/i)
    expect('from orders select p50(status) over (partition by user_id)').toHaveDiagnostic(/Expected number, got string/i)
  })

  it.skip('handles complex joins with measures', () => {
    expect('from products select name, category, total_sold where popular_item').toRenderSql(
      'select products.name as name, products.category as category, (sum(orders.amount)) as total_sold from products as products left join orders as orders on orders.product_id=products.id group by 1, 2 having sum(orders.amount)>1000 order by 3 desc nulls last',
    )
  })

  it.skip('handles subqueries', () => {
    expect('from (select id, name from users) select id, name').toRenderSql(`WITH __stage0 AS ( SELECT users.id as id, users.name as name from users as users )
      SELECT __stage0.id as id, __stage0.name as name from __stage0 as __stage0`)
  })

  it.skip('handles subqueries with alias', () => {
    expect('from (select id, name from users) as u select id, name').toRenderSql(`WITH __stage0 AS ( SELECT users.id as id, users.name as name from users as users )
      SELECT __stage0.id as id, __stage0.name as name from __stage0 as __stage0`)
  })

  // Skipped: computed columns accessed through joins are not fully expanded yet.
  // The view's computed column (orders.total_revenue) needs to be expanded when rendering
  // the CTE, but currently we treat it as a regular column reference.
  it.skip('supports "table as" (aka view) queries', async () => {
    updateFile(
      `
      table users (
        id int
        name string
        join many orders on orders.user_id = id
        join one user_facts on user_facts.id = id
        user_facts.ltv as ltv -- test out joining the view back in to its original source
      )
      table orders (id int, user_id int, amount int, sum(amount) as total_revenue)
      table user_facts as (from users select id, orders.total_revenue as ltv)
    `,
      'models.gsql',
    )

    await expect('from user_facts select id, ltv') // query the view directly
      .toReturnRows([1, 60], [2, 40])

    expect('from users select name, ltv') // query the view indirectly, through a join
      .toRenderSql(
        'with __stage0 as ( select users.id as id, (coalesce(sum(orders.amount),0)) as ltv from users as users left join orders as orders on orders.user_id=users.id group by 1 ) select users.name as name, (user_facts.ltv) as ltv from users as users left join __stage0 as user_facts on user_facts.id=users.id',
      )

    await expect('select * from users') // wildcards should include ltv
      .toReturnRows([1, 'Alice', 60], [2, 'Bob', 40])
  })

  it('handles query_source nested in join chains', () => {
    // Regression test: querying through nested joins to a query_source would crash with "Cannot read properties of null (reading 'type')"
    // because structRef wasn't set on deeply nested query objects after structuredClone
    updateFile(
      `
      table order_items (id int, user_id int, join one users on users.id = user_id)
      table users (id int, name string, join one user_facts on user_facts.id = id)
      table user_facts as (from users select id, name as fact_name)
    `,
      'models.gsql',
    )

    expect('from order_items select id, users.name').toRenderSql(
      'select order_items.id as id, users.name as name from order_items as order_items left join users as users on users.id=order_items.user_id',
    )
  })

  it('handles when the view is defined before the table', () => {
    // Covers a particular bug where if a view was analyzed before the table it queried, it'd break.
    // specifically the wildcard would include partially constructed joins
    clearWorkspace()
    updateFile('table user_facts as (from users select *)', 'facts.gsql')
    updateFile(testTables, 'models.gsql')

    expect('from user_facts select id, email order by id').toRenderSql(
      'with user_facts as ( select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from users as users ) select user_facts.id as id, user_facts.email as email from user_facts as user_facts order by 1 asc nulls last',
    )
  })

  it('qualified joins default to table name alias', () => {
    updateFile(
      `
      table dataset.users (id int, join many dataset.orders on id = orders.user_id)
      table dataset.orders (id int, user_id int)
    `,
      'models.gsql',
    )

    expect('from dataset.users select id, orders.id').toRenderSql(
      'select users.id as id, orders.id as orders_id from dataset.users as users left join dataset.orders as orders on users.id=orders.user_id',
    )
  })

  it('extends derived tables with additional measures', async () => {
    updateFile(
      `${testTables}
      table user_facts as (from users select id, total_orders)
      extend user_facts (total_orders > 1 as repeat_buyer)
    `,
      'models.gsql',
    )

    await expect('from user_facts select id, total_orders, repeat_buyer order by id').toReturnRows([1, 2, true], [2, 1, false])
  })

  it('emits CTE for views referenced through joins', async () => {
    updateFile(
      `${testTables}
      table order_stats as (from orders select user_id, sum(amount) as total_spent)
      extend users (join one order_stats on order_stats.user_id = id)
    `,
      'models.gsql',
    )

    expect('from users select name, order_stats.total_spent order by name').toRenderSql(
      'with order_stats as ( select orders.user_id as user_id, sum(orders.amount) as total_spent from orders as orders group by 1 order by 2 desc nulls last ) select users.name as name, order_stats.total_spent as total_spent from users as users left join order_stats as order_stats on order_stats.user_id=users.id order by 1 asc nulls last',
    )

    await expect('from users select name, order_stats.total_spent order by name').toReturnRows(['Alice', 60], ['Bob', 40])
  })

  it('supports select distinct', () => {
    expect('from users select distinct name, email').toRenderSql('select users.name as name, users.email as email from users as users group by 1,2 order by 1 asc nulls last')
  })

  it('coun(distinct)', () => {
    expect('from users select count(distinct name)').toRenderSql('select count(distinct users.name) as col_0 from users as users')
  })

  it('adds groupBy to select if needed', () => {
    expect('from users select count(orders.id) as total group by name').toRenderSql(
      'select users.name as name, count(distinct orders.id) as total from users as users left join orders as orders on orders.user_id=users.id group by 1 order by 2 desc nulls last',
    )
  })

  it('doesnt duplicate groupBys', () => {
    expect('from users select name, count(orders.id) group by name').toRenderSql(
      'select users.name as name, count(distinct orders.id) as col_1 from users as users left join orders as orders on orders.user_id=users.id group by 1 order by 2 desc nulls last',
    )
  })

  it('group by can refer to an alias', () => {
    expect('from users select name as n group by n').toRenderSql('select users.name as n from users as users group by 1 order by 1 asc nulls last')
  })

  it('group by positional number', async () => {
    expect('from users select name, email, avg(age) group by 2, 1').toRenderSql(
      'select users.name as name, users.email as email, avg(users.age) as col_2 from users as users group by 2,1 order by 3 desc nulls last',
    )
    await expect('from users select name, email, avg(age) group by 2, 1').toReturnRows(['Bob', 'bob@example.com', 40], ['Alice', 'alice@example.com', 30])
  })

  it('supports having clause with aggregate', async () => {
    await expect('from users select name, sum(payments.amount) as amt group by name having amt > 50').toReturnRows(['Alice', 100])
  })

  it('supports post-agg filters without the need for "having"', async () => {
    await expect('from users select name, sum(payments.amount) as amt where amt > 50 group by name').toReturnRows(['Alice', 100])
  })

  it('supports order by with direction', async () => {
    await expect('from users select name, total_orders order by total_orders desc').toReturnRows(['Alice', 2], ['Bob', 1])
  })

  it('order by positional number', () => {
    expect('from users select name, email order by 2 asc, 1 desc').toRenderSql('select users.name as name, users.email as email from users as users order by 2 asc nulls last,1 desc nulls last')
  })

  it('order by nonexistent field produces diagnostic', () => {
    expect('from users select name order by nonexistent').toHaveDiagnostic(/Unknown field in ORDER BY: nonexistent/i)
  })

  it('supports limit clause', async () => {
    await expect('from users select name order by name asc limit 1').toReturnRows(['Alice'])
  })

  it('supports is null/is not null', () => {
    expect('from users select name where email is null').toRenderSql('select users.name as name from users as users where users.email is null')

    expect('from users select name where email is not null').toRenderSql('select users.name as name from users as users where users.email is not null')
  })

  it('parses offset but reports diagnostic', () => {
    expect('from users select name order by name asc limit 1 offset 1').toHaveDiagnostic(/offset is not supported/i)
  })

  it('supports in expressions', () => {
    expect("from users select id where name in ('Alice','Bob')").toRenderSql("select users.id as id from users as users where users.name in ('Alice','Bob')")
    expect("from users select id where name not in ('Alice','Bob')").toRenderSql("select users.id as id from users as users where users.name not in ('Alice','Bob')")
  })

  it('supports between expressions', () => {
    expect('from users select id where age between 18 and 30').toRenderSql('select users.id as id from users as users where users.age BETWEEN 18 AND 30')
    expect('from users select id where age not between 18 and 30').toRenderSql('select users.id as id from users as users where users.age NOT BETWEEN 18 AND 30')
    expect('from users select id where age between 18 and 30 and email is not null').toRenderSql(
      'select users.id as id from users as users where (users.age BETWEEN 18 AND 30 AND users.email IS NOT NULL)',
    )
    expect('from users select id where age between 18 and 30 or email is not null').toRenderSql(
      'select users.id as id from users as users where (users.age BETWEEN 18 AND 30 OR users.email IS NOT NULL)',
    )
  })

  it('supports case expressions', () => {
    expect("from users select case when age > 35 then 'old' else 'young' end as bucket").toRenderSql("select case when (users.age>35) then 'old' else 'young' end as bucket from users as users")
  })

  it('propagates isAgg through case expressions for GROUP BY', () => {
    expect("from users select name, case when count() > 2 then 'many' else 'few' end as bucket").toRenderSql(
      "select users.name as name, case WHEN (count(1)>2) THEN 'many' ELSE 'few' END as bucket from users as users group by 1 order by 2 desc nulls last",
    )
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
        #format=first_last
        name text,
        another_field text, -- this is another field #units=seconds
      )
      from t select name
    `)
    let table = getTable('t')!
    expect(String(table.metadata?.description || '').toLowerCase()).toContain('this is my test table')
    let name = table.columns.find(c => c.name === 'name')!
    expect(String(name.metadata!.description || '').toLowerCase()).toContain('a description')
    expect(name.metadata!.format).toBe('first_last')
    let another = table.columns.find(c => c.name === 'another_field')!
    expect(String(another.metadata!.description || '').toLowerCase()).toContain('this is another field')
    expect(another.metadata!.units).toBe('seconds')
  })

  it('parses quoted values and multiple hash metadata comments', () => {
    analyze(`
      -- currency metrics
      #color=green #hide #format="US Dollar"
      table revenue (
        amount int,
        -- gross revenue #units=usd #hide #format="US Dollar"
        gross int,
        net int #units=usd #hide #format="US Dollar"
      )
      from revenue select gross, net
    `)

    let table = getTable('revenue')!
    expect(table.metadata).toMatchObject({description: 'currency metrics', color: 'green', hide: 'true', format: 'US Dollar'})
    let gross = table.columns.find(c => c.name === 'gross')!
    expect(gross.metadata).toMatchObject({description: 'gross revenue', units: 'usd', hide: 'true', format: 'US Dollar'})
    let net = table.columns.find(c => c.name === 'net')!
    expect(net.metadata).toMatchObject({units: 'usd', hide: 'true', format: 'US Dollar'})
  })

  it('keeps literal hash signs in descriptions while parsing trailing metadata pairs', () => {
    analyze(`
      table foo (
        -- Description with # sign #hide #pii
        name text
      )
    `)

    let table = getTable('foo')!
    let name = table.columns.find(c => c.name === 'name')!
    expect(name.metadata).toMatchObject({description: 'Description with # sign', hide: 'true', pii: 'true'})
  })

  it('treats trailing dash comments in hash metadata lines as description', () => {
    analyze(`
      table foo (
        #hide #key=value -- More comment
        name text
      )
    `)

    let table = getTable('foo')!
    let name = table.columns.find(c => c.name === 'name')!
    expect(name.metadata).toMatchObject({hide: 'true', key: 'value', description: 'More comment'})
  })

  it('does not parse legacy dash-hash metadata comments', () => {
    analyze(`
      table foo (
        --# format=first_last
        name text
      )
    `)

    let table = getTable('foo')!
    let name = table.columns.find(c => c.name === 'name')!
    expect(name.metadata?.format).toBeUndefined()
    expect(name.metadata?.description).toBeUndefined()
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
    expect(String(id.metadata!.description || '').toLowerCase()).toContain('name field')
    expect(name.metadata?.description).toBeUndefined()
  })

  it('propagates field metadata from table columns to query output fields', () => {
    updateFile(
      `table revenue (
      amount int -- gross revenue #units=usd
    )`,
      'revenue.gsql',
    )

    let [query] = analyze('from revenue select amount')
    expect(query.fields[0].metadata).toMatchObject({units: 'usd'})
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

  it('supports array column types in table schemas', () => {
    clearWorkspace()
    updateFile('table events (tags array<string>, scores array<int64>)', 'arrays.gsql')
    analyze()

    let table = getTable('events')!
    expect(table.columns.map(col => formatType(col.type))).toEqual(['array<string>', 'array<number>'])
  })

  it('rejects nested array column types', () => {
    expect('table invalid (tags array<array<string>>)').toHaveDiagnostic(/nested arrays are not supported/i)
  })

  it('reports syntax errors for incomplete array type syntax', () => {
    expect('table invalid (tags array<>)').toHaveDiagnostic(/syntax error/i)
    expect('from users select cast(name as array<string>)').toHaveNoErrors()
    expect('from users select cast(name as array<string>)').toRenderSql('select CAST(users.name AS ARRAY<STRING>) as col_0 from users as users')
    expect('from users select cast(name as array<string)').toHaveDiagnostic(/syntax error/i)
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
    expect('from not_a_table select id').toHaveDiagnostic(/unknown table "not_a_table"/i)
  })

  it('reports diagnostics for unknown column', () => {
    expect('from orders select users.does_not_exist').toHaveDiagnostic(/unknown field "does_not_exist" on users/i)
  })

  it('reports diagnostics for unknown columns in table join conditions', () => {
    expect(`
      table users (id int)
      table orders (
        user_id int,
        join one users on users.does_not_exist = user_id
      )
    `).toHaveDiagnostic(/unknown field "does_not_exist" on users/i)
  })

  it('reports not being able to find a join on a query', () => {
    expect(`
      table t (oid int, join one users as usr on usr.id = oid);
      from t select users.name
    `).toHaveDiagnostic(/Could not find "users" on query/i)
  })

  it('can create new tables from queries', () => {
    expect(`table completed_orders as (from orders where status = 'completed' select id)
      from completed_orders select id`).toRenderSql(
      "with completed_orders as ( select orders.id as id from orders as orders where orders.status='completed' ) select completed_orders.id as id from completed_orders as completed_orders",
    )
  })

  it('can correctly count through a join', () => {
    expect('from orders select count(users.id)').toRenderSql('select count(distinct users.id) as col_0 from orders as orders left join users as users on users.id=orders.user_id')
  })

  it('handles min/max through a join', () => {
    expect('from orders select min(users.age)').toRenderSql('select min(users.age) as col_0 from orders as orders left join users as users on users.id=orders.user_id')
  })

  it('supports function calling', () => {
    expect("from users select coalesce(name, 'Unknown') as name2").toRenderSql("select coalesce(users.name,'Unknown') as name2 from users as users")
  })

  it('supports agg function calling', () => {
    expect('from users select age, string_agg(name)').toRenderSql('select users.age as age, string_agg(users.name) as col_1 from users as users group by 1 order by 2 desc nulls last')
  })

  it('rejects variadic functions called with 0 args', () => {
    expect('from users select coalesce() as empty').toHaveDiagnostic(/wrong number of arguments/i)
  })

  it('reports wrong number of arguments instead of unknown function', () => {
    expect('from users select lpad(name, 5)').toHaveDiagnostic(/wrong number of arguments for lpad/i)
  })

  it('type-checks variadic args beyond the first', () => {
    // concat expects string... — passing a number as the 2nd arg should be caught
    expect('from users select concat(name, age)').toHaveDiagnostic(/expected.*string/i)
  })

  it('treats generic aggregate functions as aggregates', () => {
    // any_value returns T and is an aggregate - it should be treated as an aggregate
    // This test ensures generic return types with aggregate: true are properly marked as measures
    // When working correctly, it should generate SQL with group by (since it's an aggregate)
    expect('from users select name, any_value(age) as sample_age').toRenderSql(
      'select users.name as name, any_value(users.age) as sample_age from users as users group by 1 order by 2 desc nulls last',
    )
  })

  it.skip('supports malloy date functions', () => {
    expect('from users select name, month(created_at)').toRenderSql('select users.name as name, extract(month from users.created_at) as col_1 from users as users')
  })

  it('allows queries with semicolons', () => {
    expect('table t (id int); select id, name from users;').toRenderSql('select users.id as id, users.name as name from users as users')
  })

  it('allows trailing commas in select/group/order/in lists and function args', () => {
    expect('select id, name, from users').toRenderSql('select users.id as id, users.name as name from users as users')

    expect('from users select count() group by name,').toRenderSql('select users.name as name, count(1) as col_0 from users as users group by 1 order by 2 desc nulls last')

    expect('from users select name order by name asc,').toRenderSql('select users.name as name from users as users order by 1 asc nulls last')

    expect("from users select id where name in ('Alice','Bob',)").toRenderSql("select users.id as id from users as users where users.name in ('Alice','Bob')")

    expect("from users select coalesce(name, 'Unknown',) as name2").toRenderSql("select coalesce(users.name,'Unknown') as name2 from users as users")
  })

  it('allows optional commas between table items and semicolon terminators', () => {
    expect(`table t (
      id int,
      name text
    );
    from t select id, name`).toRenderSql('select t.id as id, t.name as name from t as t')

    expect(`table completed_ids as (from users select id,) ;
      from completed_ids select id`).toRenderSql('with completed_ids as ( select users.id as id from users as users ) select completed_ids.id as id from completed_ids as completed_ids')
  })

  it('supports count_if (function we added)', () => {
    expect('from orders select count_if(amount > 100)').toRenderSql('select count_if(orders.amount>100) as col_0 from orders as orders')
  })

  it('supports count_if alias for countif on BigQuery', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select count_if(amount > 100)').toRenderSql('select countif(orders.amount>100) as col_0 from `orders` as orders')
  })

  it('supports BigQuery math functions', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select abs(amount), sqrt(amount), round(amount, 2)').toRenderSql(
      'select abs(orders.amount) as col_0, sqrt(orders.amount) as col_1, round(orders.amount,2) as col_2 from `orders` as orders',
    )
  })

  it('supports BigQuery string functions', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from users select lower(name), upper(name), length(name)').toRenderSql('select lower(users.name) as col_0, upper(users.name) as col_1, length(users.name) as col_2 from `users` as users')
  })

  it('supports functions with keyword args', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from users select timestamp_diff(created_at, created_at, day)').toRenderSql('select timestamp_diff(users.created_at,users.created_at,day) as col_0 from `users` as users')
  })

  it('renders BigQuery pXX windows via PERCENTILE_CONT', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select id, p50(amount) over (partition by user_id) as p50_by_user order by id').toRenderSql(
      'select orders.id as id, PERCENTILE_CONT(orders.amount, 0.5) OVER (PARTITION BY orders.user_id) as p50_by_user from `orders` as orders order by 1 asc nulls last',
    )
  })

  it('keeps existing BigQuery non-window pXX behavior', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select p50(amount) as p50').toRenderSql('select approx_quantiles(orders.amount, 100)[OFFSET(50)] as p50 from `orders` as orders')
  })

  it('keeps BigQuery pXX limits for windows', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select p999(amount) over (partition by user_id)').toHaveDiagnostic(/BigQuery only supports up to p99/i)
  })

  it('treats date part keywords as literals only when allowed', () => {
    setGlobalConfig({root: '', bigquery: {}})
    updateFile('table calendar (created_at timestamp, day text, week text)', 'calendar.gsql')

    expect('from calendar select week').toRenderSql('select calendar.week as week from `calendar` as calendar')

    expect('from calendar select timestamp_diff(created_at, created_at, week)').toRenderSql('select timestamp_diff(calendar.created_at,calendar.created_at,week) as col_0 from `calendar` as calendar')

    expect('from calendar select date_trunc(created_at, week)').toRenderSql('select date_trunc(calendar.created_at,week) as col_0 from `calendar` as calendar')
  })

  it('supports date_trunc on date columns (as opposed to timestamp)', () => {
    setGlobalConfig({root: '', bigquery: {}})
    updateFile('table events (event_date date)', 'events.gsql')
    expect('from events select date_trunc(event_date, month)').toRenderSql('select date_trunc(events.event_date,month) as col_0 from `events` as events')

    setGlobalConfig({root: ''}) // duckdb (default)
    expect("from events select date_trunc('month', event_date)").toRenderSql("select date_trunc('month',events.event_date) as col_0 from events as events")

    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect("from events select date_trunc('month', event_date)").toRenderSql("select DATE_TRUNC('month',EVENTS.EVENT_DATE) as COL_0 from EVENTS as EVENTS")
  })

  it('infers temporal grain from date_trunc across dialects', () => {
    updateFile('table events (event_date date)', 'events.gsql')

    setGlobalConfig({root: '', bigquery: {}})
    let [bigQuery] = analyze('from events select date_trunc(event_date, month) as month_start')
    expect(bigQuery.fields[0].metadata).toEqual({timeGrain: 'month'})

    setGlobalConfig({root: ''})
    let [duckDb] = analyze("from events select date_trunc('quarter', event_date) as quarter_start")
    expect(duckDb.fields[0].metadata).toEqual({timeGrain: 'quarter'})

    setGlobalConfig({dialect: 'snowflake', root: ''})
    let [snowflake] = analyze("from events select date_trunc('year', event_date) as year_start")
    expect(snowflake.fields[0].metadata).toEqual({timeGrain: 'year'})

    setGlobalConfig({dialect: 'clickhouse', root: ''})
    let [clickhouse] = analyze("from events select date_trunc('week', event_date) as week_start")
    expect(clickhouse.fields[0].metadata).toEqual({timeGrain: 'week'})
  })

  it('propagates temporal grain through refs and replaces it with extraction metadata for reshaping expressions', () => {
    updateFile(
      `
      table events (
        event_date date
        month_start: date_trunc('month', event_date)
      )
    `,
      'events.gsql',
    )

    let [throughRef] = analyze('from events select month_start')
    expect(throughRef.fields[0].metadata).toEqual({timeGrain: 'month'})

    let [throughCast] = analyze('from events select cast(month_start as date) as month_date')
    expect(throughCast.fields[0].metadata).toEqual({timeGrain: 'month'})

    let [reshaped] = analyze('from events select extract(year from month_start) as year_num')
    expect(reshaped.fields[0].metadata).toEqual({timePart: 'year'})
  })

  it('drops temporal grain on set operations when branches disagree', () => {
    updateFile('table events (event_date date)', 'events.gsql')

    let [query] = analyze(`
      from events select date_trunc('month', event_date) as bucket
      union all
      from events select date_trunc('year', event_date) as bucket
    `)

    expect(query.fields[0].metadata).toBeUndefined()
  })

  it('supports extract expressions', () => {
    expect('from users select extract(hour from created_at)').toRenderSql('select extract(hour from users.created_at) as col_0 from users as users')
  })

  it('supports backend-native temporal extraction shorthands', () => {
    updateFile('table events (event_date date, created_at timestamp)', 'events.gsql')

    setGlobalConfig({root: ''})
    expect('from events select hour(created_at), quarter(event_date)').toHaveNoErrors()

    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect('from events select dayofmonth(event_date), weekofyear(event_date)').toHaveNoErrors()

    setGlobalConfig({dialect: 'clickhouse', root: ''})
    expect('from events select to_quarter(created_at), to_week(created_at), to_day_of_year(created_at)').toHaveNoErrors()

    setGlobalConfig({root: ''})
  })

  it('infers time part and ordinal metadata for extract, date_part, and native shorthands', () => {
    updateFile('table events (event_date date, created_at timestamp)', 'events.gsql')

    setGlobalConfig({root: '', bigquery: {}})
    let [bigQuery] = analyze('from events select extract(dayofweek from event_date) as dow')
    expect(bigQuery.fields[0].metadata).toEqual({timePart: 'dayofweek', timeOrdinal: 'dow_1s'})

    setGlobalConfig({root: ''})
    let [duckDbDow] = analyze("from events select date_part('dow', event_date) as dow")
    expect(duckDbDow.fields[0].metadata).toEqual({timePart: 'dayofweek', timeOrdinal: 'dow_0s'})
    let [duckDbIsoDow] = analyze('from events select extract(isodow from event_date) as iso_dow')
    expect(duckDbIsoDow.fields[0].metadata).toEqual({timePart: 'isodow', timeOrdinal: 'dow_1m'})
    let [duckDbQuarter] = analyze('from events select quarter(event_date) as quarter_num')
    expect(duckDbQuarter.fields[0].metadata).toEqual({timePart: 'quarter', timeOrdinal: 'quarter_of_year'})

    setGlobalConfig({dialect: 'snowflake', root: ''})
    let [snowflake] = analyze('from events select dayofweek(event_date) as dow')
    expect(snowflake.fields[0].metadata).toEqual({timePart: 'dayofweek', timeOrdinal: 'dow_0s'})
    let [snowflakeQuarter] = analyze('from events select quarter(event_date) as quarter_num')
    expect(snowflakeQuarter.fields[0].metadata).toEqual({timePart: 'quarter', timeOrdinal: 'quarter_of_year'})

    setGlobalConfig({dialect: 'clickhouse', root: ''})
    let [clickhouse] = analyze('from events select to_day_of_week(created_at) as dow')
    expect(clickhouse.fields[0].metadata).toEqual({timePart: 'dayofweek', timeOrdinal: 'dow_1m'})
    let [clickhouseHour] = analyze('from events select to_hour(created_at) as hour_num')
    expect(clickhouseHour.fields[0].metadata).toEqual({timePart: 'hour', timeOrdinal: 'hour_of_day'})
    let [clickhouseQuarter] = analyze('from events select to_quarter(created_at) as quarter_num')
    expect(clickhouseQuarter.fields[0].metadata).toEqual({timePart: 'quarter', timeOrdinal: 'quarter_of_year'})

    setGlobalConfig({root: ''})
  })

  it('drops extraction metadata on set operations when branches disagree', () => {
    updateFile('table events (event_date date, created_at timestamp)', 'events.gsql')

    let [query] = analyze(`
      from events select extract(hour from created_at) as bucket
      union all
      from events select extract(month from created_at) as bucket
    `)

    expect(query.fields[0].metadata).toBeUndefined()
  })

  it('supports null and boolean literals', () => {
    expect('from users select name, null, true, FALSE').toRenderSql('select users.name as name, null as col_1, true as col_2, false as col_3 from users as users')
  })

  it('coerces string literals to timestamps in comparisons', () => {
    expect("from users select id where created_at >= '2024-01-01'").toRenderSql("select users.id as id from users as users where users.created_at>=TIMESTAMP '2024-01-01 00:00:00'")
  })

  it('coerces string literals to timestamps in IN lists', () => {
    expect("from users select id where created_at in ('2024-01-01','2024-01-02')").toRenderSql(
      "select users.id as id from users as users where users.created_at in (TIMESTAMP '2024-01-01 00:00:00',TIMESTAMP '2024-01-02 00:00:00')",
    )
  })

  it('coerces string literals to timestamps in BETWEEN bounds', () => {
    expect("from users select id where created_at between '2024-01-01' and '2024-01-31'").toRenderSql(
      "select users.id as id from users as users where users.created_at BETWEEN TIMESTAMP '2024-01-01 00:00:00' AND TIMESTAMP '2024-01-31 00:00:00'",
    )
  })

  it('diagnoses string used where interval expected', () => {
    expect("from users select created_at + 'many moons'").toHaveDiagnostic(/Invalid date arithmetic/i)
  })

  it('parses temporal parameters at runtime', () => {
    let queries = analyze(`${testTables}
      from users select id where created_at >= $start_date
    `)
    expect(toSql(queries[0], {start_date: '2024-01-01'})).toMatch(/>=DATE '2024-01-01'/)
  })

  it('diagnoses invalid timestamp literals', () => {
    expect("from users select id where created_at >= 'soonish'").toHaveDiagnostic(/Cannot parse as timestamp/i)
  })

  it('supports interval keyword with quoted string', () => {
    expect("from users select created_at + interval '5 minutes' as shifted").toRenderSql('select users.created_at + interval 5 minute as shifted from users as users')
  })

  it('supports interval keyword with unquoted number and unit', () => {
    expect('from users select created_at + interval 5 minutes as shifted').toRenderSql('select users.created_at + interval 5 minute as shifted from users as users')
  })

  it('supports interval keyword with numeric field quantity', () => {
    expect('from users select created_at - interval age minute as shifted').toRenderSql('select users.created_at - (users.age * (interval 1 minute)) as shifted from users as users')
  })

  it('supports multiplied literal intervals in date arithmetic', () => {
    expect('from users select created_at - (age * interval 1 minute) as shifted').toRenderSql('select users.created_at - (users.age * (interval 1 minute)) as shifted from users as users')
  })

  it('supports multiplied literal intervals in computed columns', () => {
    updateFile('table flights (dep_time timestamp, dep_delay int, scheduled_dep_time: dep_time - (dep_delay * interval 1 minute))', 'flights.gsql')
    expect('from flights select scheduled_dep_time').toRenderSql('select (flights.dep_time - (flights.dep_delay * (interval 1 minute))) as scheduled_dep_time from flights as flights')
  })

  it('diagnoses multiplied dynamic intervals', () => {
    expect('from users select created_at - (age * interval id minute) as shifted').toHaveDiagnostic(/Only literal intervals can be multiplied/i)
  })

  it('diagnoses standalone multiplied intervals', () => {
    expect('from users select age * interval 1 minute as shifted').toHaveDiagnostic(/only supported inside date\/time arithmetic/i)
  })

  it('renders dynamic intervals for BigQuery', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from users select created_at - interval age minute as shifted').toRenderSql('select users.created_at - interval users.age minute as shifted from `users` as users')
    expect('from users select created_at - (age * interval 1 minute) as shifted').toRenderSql('select users.created_at - interval users.age minute as shifted from `users` as users')
  })

  it('renders dynamic intervals for Snowflake via DATEADD', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect('from users select created_at - interval age minute as shifted').toRenderSql('SELECT TIMESTAMPADD(minute, -(users.age), users.created_at) as shifted FROM USERS as users')
    expect('from users select created_at - (age * interval 1 minute) as shifted').toRenderSql('SELECT TIMESTAMPADD(minute, -(users.age), users.created_at) as shifted FROM USERS as users')
  })

  it('supports date keyword', () => {
    expect("from users select date '2024-01-01' as d").toRenderSql("select DATE '2024-01-01' as d from users as users")
  })

  it('allows temporal keywords as column names', () => {
    // Columns can be named 'date' or 'timestamp' even though these are also keywords for literals
    updateFile('table foo (id VARCHAR, date DATE, timestamp TIMESTAMP)', 'foo.gsql')
    expect('from foo select id').toRenderSql('select foo.id as id from foo as foo')
  })

  it('supports timestamp keyword', () => {
    expect("from users select id where created_at >= timestamp '2024-01-01 12:00:00'").toRenderSql("select users.id as id from users as users where users.created_at>=TIMESTAMP '2024-01-01 12:00:00'")
  })

  it('supports ::DATE cast syntax', () => {
    expect("from users select '2024-01-01'::DATE as d").toRenderSql("select CAST('2024-01-01' AS DATE) as d from users as users")
  })

  it('diagnoses invalid date literal in date keyword', () => {
    expect("from users select date 'not-a-date'").toHaveDiagnostic(/Invalid date/i)
  })

  it('diagnoses invalid interval unit', () => {
    expect('from users select created_at + interval 5 moons').toHaveDiagnostic(/Invalid interval unit/i)
  })

  it('diagnoses non-numeric interval quantities', () => {
    expect('from users select created_at + interval name minute').toHaveDiagnostic(/Expected number, got string/i)
  })

  it.skip('errors when aggregates are nested', () => {
    expect('from users select name, sum(total_orders)').toHaveDiagnostic(/Aggregates cannot be nested/i)
  })

  it('rejects computed fields fanned out by a join many', () => {
    expect(`table t (
      uid int
      join many users on users.id = uid
      user_age: users.age
    )`).toHaveDiagnostic(/Expression is fanned out by join to table `users`; aggregate it first/i)
  })

  it('reports a chasm trap when a measure mixes sibling join many grains', () => {
    expect(`table t (
      id int
      join many orders on orders.user_id = id
      join many payments on payments.user_id = id
      weird: sum(orders.amount) / sum(payments.amount)
    )
    table orders (id int, user_id int, amount int)
    table payments (id int, user_id int, amount int)`).toHaveDiagnostic(/Join graph creates a chasm trap/i)
  })

  it('allows a measure after each fanout grain is aggregated separately', () => {
    expect(`
      table orders_agg (id int, user_id int, amount int)
      table payments_agg (id int, user_id int, amount int)
      table order_totals as (from orders_agg select user_id, sum(amount) as order_total)
      table payment_totals as (from payments_agg select user_id, sum(amount) as payment_total)
      table t (
        id int
        join one order_totals on order_totals.user_id = id
        join one payment_totals on payment_totals.user_id = id
        weird: order_totals.order_total / payment_totals.payment_total
      )
    `).toHaveNoErrors()
  })

  it('reports a chasm trap when an aggregate query expression mixes sibling join many branches', () => {
    expect('from users select name, orders.amount + payments.amount, count(id)').toHaveDiagnostic(/Join graph creates a chasm trap/i)
  })

  it('reports a chasm trap when a computed field mixes sibling join many branches', () => {
    expect(`table t (
      id int
      join many orders on orders.user_id = id
      join many payments on payments.user_id = id
      bad_expr: orders.amount + payments.amount
    )
    table orders (id int, user_id int, amount int)
    table payments (id int, user_id int, amount int)`).toHaveDiagnostic(/Join graph creates a chasm trap/i)
  })

  it('allows join expressions to refer to the alias', () => {
    expect('table t (oid int, join one users as usr on usr.id = oid); from t select usr.name').toRenderSql('select usr.name as name from t as t left join users as usr on usr.id=t.oid')
  })

  it('allows measures to refer to themselves', () => {
    expect('table t (oid int, count(distinct t.oid) as total_oids)').toHaveNoErrors()
  })

  it('replaces parameters in filter conditions', () => {
    let queries = analyze(`${testTables}
      from users select id where name = $name
    `)
    expect(toSql(queries[0], {name: 'Alice'})).toMatch(/WHERE users\.name='Alice'/)
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
    `).toRenderSql('select current_date() as col_0, current_time() as col_1, current_timestamp() as col_2, current_timestamp(3) as col_3, localtimestamp() as col_4 from users as users')
  })

  it('supports duckdb bare current datetime functions', () => {
    expect(`
      from users select
        current_date,
        current_time,
        current_timestamp,
        localtime,
        local_timestamp,
        localtimestamp
    `).toRenderSql(
      'select current_date as current_date, current_time as current_time, current_timestamp as current_timestamp, localtime as localtime, localtimestamp as local_timestamp, localtimestamp as localtimestamp from users as users',
    )
  })

  it('supports bigquery current datetime functions with optional args', () => {
    setGlobalConfig({root: '', bigquery: {}})
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
      `).toRenderSql(
        "select current_date() as col_0, current_date('America/Los_Angeles') as col_1, current_time() as col_2, current_time('UTC') as col_3, current_timestamp() as col_4, current_timestamp('America/Los_Angeles') as col_5, current_datetime() as col_6, current_datetime() as col_7, current_datetime('UTC') as col_8 from `users` as users",
      )
    } finally {
      setGlobalConfig({root: ''})
    }
  })

  it('supports bigquery bare current datetime functions', () => {
    setGlobalConfig({root: '', bigquery: {}})
    try {
      expect(`
        from users select
          current_date,
          current_datetime,
          current_time,
          current_timestamp,
          local_timestamp
      `).toRenderSql(
        'select current_date as current_date, current_datetime as current_datetime, current_time as current_time, current_timestamp as current_timestamp, current_datetime as local_timestamp from `users` as users',
      )
    } finally {
      setGlobalConfig({root: ''})
    }
  })

  it('supports snowflake bare current datetime functions', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    try {
      expect(`
        from users select
          current_date,
          current_time,
          current_timestamp,
          localtime,
          localtimestamp
      `).toRenderSql(
        'SELECT current_date as current_date, current_time as current_time, current_timestamp as current_timestamp, localtime as localtime, localtimestamp as localtimestamp FROM USERS as users',
        {preserveCase: true},
      )
    } finally {
      setGlobalConfig({root: ''})
    }
  })

  it('supports clickhouse current datetime functions without bare aliases', () => {
    setGlobalConfig({dialect: 'clickhouse', root: ''})
    try {
      expect(`
        from users select
          current_date(),
          current_timestamp()
      `).toRenderSql('SELECT current_date() as col_0, current_timestamp() as col_1 FROM users as users')

      expect('from users select current_date').toHaveDiagnostic(/Unknown field "current_date" on users/i)
      expect('from users select current_time()').toHaveDiagnostic(/Unknown function: current_time/i)
      expect('from users select localtimestamp').toHaveDiagnostic(/Unknown field "localtimestamp" on users/i)
    } finally {
      setGlobalConfig({root: ''})
    }
  })

  it('supports broader clickhouse function coverage', () => {
    setGlobalConfig({dialect: 'clickhouse', root: ''})
    try {
      expect('from users select count_if(age > 18) as adults').toRenderSql('SELECT countIf(users.age>18) as adults FROM users as users')
      expect('from users select sum_if(age, age > 18) as adult_age_sum').toRenderSql('SELECT sumIf(users.age,users.age>18) as adult_age_sum FROM users as users')
      expect("from users select startswith(name, 'A') as starts_a").toRenderSql("SELECT startsWith(users.name,'A') as starts_a FROM users as users")
      expect("from users select format_datetime(created_at, '%Y-%m') as month_label").toRenderSql("SELECT formatDateTime(users.created_at,'%Y-%m') as month_label FROM users as users")
      expect('from users select to_year(created_at) as year_num').toRenderSql('SELECT toYear(users.created_at) as year_num FROM users as users')
    } finally {
      setGlobalConfig({root: ''})
    }
  })

  it('keeps column refs ahead of bare niladic functions', () => {
    let queries = analyze(`
      table t (
        current_date int
      )
      from t select current_date, t.current_date
    `)
    expect(toSql(queries[0])).toMatch(/select t\.current_date as current_date, t\.current_date as t_current_date from t as t/i)
  })

  it('still errors for unknown bare names', () => {
    expect('from users select definitely_not_a_function').toHaveDiagnostic(/Unknown field "definitely_not_a_function" on users/i)
  })

  it('does not add bare support for excluded functions', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    try {
      expect('from users select sysdate').toHaveDiagnostic(/Unknown field "sysdate" on users/i)
    } finally {
      setGlobalConfig({root: ''})
    }

    expect('from users select now').toHaveDiagnostic(/Unknown field "now" on users/i)
  })

  it.skip('applies parameters inside views', () => {
    let queries = analyze(`${testTables}
      table active_users as (from users select id where age > $minAge)
      from active_users select id
    `)
    expect(toSql(queries[0], {minAge: 20})).toMatch(/WHERE users\.age>20/)
  })

  it.skip('supports array parameters in filters', () => {
    let queries = analyze(`${testTables}
      from users select id where name in ($names)
    `)
    let sql = toSql(queries[0], {names: ['Alice', 'Bob']})
    expect(sql).toMatch(/IN \(\(ARRAY\['Alice','Bob'\]\)\)/)
  })

  it('assumes * when no fields are selected', () => {
    expect('from users').toRenderSql('select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from users as users')
  })

  it('can analyze markdown files', () => {
    expect(`## My analysis
      \`\`\`gsql test
        from users where age > 20
      \`\`\`
      <BarChart data="test" x="name" y="avg(age)" />
    `).toRenderSql(
      'with test as ( select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from users as users where users.age>20 ) select test.name as name, avg(test.age) as col_1 from test as test group by 1 order by 2 desc nulls last',
    )
  })

  it('snowflake named markdown queries preserve lowercase aliases in component references', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect(`
      \`\`\`gsql by_state
        from users select name as state_code, count() as num
      \`\`\`
      <BarChart data="by_state" x="state_code" y="num" />
    `).toRenderSql(
      'WITH by_state as ( SELECT users.name as state_code, count(1) as num FROM USERS as users GROUP BY 1 ORDER BY 2 desc NULLS LAST ) SELECT by_state.state_code as state_code, by_state.num as num FROM by_state as by_state',
      {preserveCase: true},
    )
  })

  it('reports the right line/col number for markdown errors', () => {
    analyze(
      trimIndentation(`## My analysis
      \`\`\`gsql test
        from users where discount > 20
      \`\`\`
    `),
      'md',
    )
    let errors = getDiagnostics().filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0].from?.line).toBe(2)
    expect(errors[0].from?.col).toBe(19)
    expect(errors[0].to?.col).toBe(27)
  })

  it('marks markdown component attribute errors across the attribute value', () => {
    analyze('<BarChart data="users" x="code" y="age" />', 'md')
    let errors = getDiagnostics().filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Unknown field "code"')
    expect(errors[0].from?.line).toBe(0)
    expect(errors[0].from?.col).toBe(26)
    expect(errors[0].to?.col).toBe((errors[0].from?.col || 0) + 4)
  })

  it('parses components with > inside quoted attribute values', () => {
    expect(`
      \`\`\`gsql test
        from users where age > 20
      \`\`\`
      <BarChart data="test" x="name" y="avg(age)" title="Count > 0" />
    `).toRenderSql(
      'with test as ( select users.id as id, users.name as name, users.email as email, users.created_at as created_at, users.age as age from users as users where users.age>20 ) select test.name as name, avg(test.age) as col_1 from test as test group by 1 order by 2 desc nulls last',
    )
  })

  it('validates unquoted chart attributes and extracts splitBy and sort fields', () => {
    expect(`
      \`\`\`gsql test
        from users select name, age, email, created_at
      \`\`\`
      <BarChart data=test x=name y=age splitBy=email sort="created_at asc" />
    `).toRenderSql(
      'with test as ( select users.name as name, users.age as age, users.email as email, users.created_at as created_at from users as users ) select test.name as name, test.age as age, test.email as email, test.created_at as created_at from test as test',
    )

    analyze('<BarChart data=users x=name y=age sort="name asc" />', 'md')
    expect(getDiagnostics().filter(d => d.severity === 'error')).toEqual([])
  })

  it('reports unsupported chart wrapper props with migration hints', () => {
    analyze('<BarChart data=users x=name y=age series=email />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "series" on BarChart\. Use splitBy instead\./.test(d.message))).toBe(true)

    analyze('<AreaChart data=users x=name y=age type=stacked100 />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "type" on AreaChart\. Use arrange="stack100" instead\./.test(d.message))).toBe(true)

    analyze('<PieChart data=users category=name value=age emptySet=warn />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "emptySet" on PieChart\. emptySet is not supported/.test(d.message))).toBe(true)
  })

  it('rejects subtitle on chart wrappers', () => {
    analyze('<PieChart data=users category=name value=age subtitle="Age split" />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "subtitle"/.test(d.message))).toBe(true)

    analyze('<BarChart data=users x=name y=age subtitle="Age split" />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "subtitle"/.test(d.message))).toBe(true)
  })

  it('ignores chart-looking tags inside fenced code blocks', () => {
    expect(`
      \`\`\`markdown
      <BarChart data=users x=name y=age series=email />
      \`\`\`
    `).toHaveNoErrors()
  })

  it('allows LineChart y2 in markdown', () => {
    analyze('<LineChart data=users x=name y=age y2=total_orders />', 'md')
    expect(getDiagnostics().filter(d => d.severity === 'error')).toEqual([])
  })

  it('reports unsupported LineChart wrapper props', () => {
    analyze('<LineChart data=users x=name y=age y2=total_orders y2Fmt=num0 />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "y2Fmt" on LineChart\. Use field metadata or ECharts for custom formatting\./.test(d.message))).toBe(true)
  })

  it('allows AreaChart y2 in markdown', () => {
    analyze('<AreaChart data=users x=name y=age y2=total_orders />', 'md')
    expect(getDiagnostics().filter(d => d.severity === 'error')).toEqual([])
  })

  it('reports unsupported AreaChart wrapper props', () => {
    analyze('<AreaChart data=users x=name y=age y2=total_orders y2Fmt=num0 />', 'md')
    expect(getDiagnostics().some(d => /Unsupported prop "y2Fmt" on AreaChart\. Use field metadata or ECharts for custom formatting\./.test(d.message))).toBe(true)
  })

  it('handles params in a md code fence', () => {
    let queries = analyze('```gsql test\nfrom users where age > $cutoff\n```\n<BarChart data="test" x="name" y="avg(age)" />', 'md')
    let sql = toSql(queries[0], {cutoff: 20})
    expect(sql).toMatch(/age>20/)
  })

  it('trimmed sanitization breaks a simple join cycle', () => {
    clearWorkspace()
    setGlobalConfig({root: ''})
    updateFile(
      `
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
    `,
      'cycle.gsql',
    )
    expect('from alpha select count(*)').toRenderSql('select count(1) as col_0 from alpha as alpha')
    expect('from alpha select avg_num').toRenderSql('select (avg(beta.num)) as avg_num from alpha as alpha left join beta as beta on beta.alpha_id=alpha.id')
    // expect('from beta select alpha.avg_num').toRenderSql('')
  })

  it('supports legacy computed column syntax (expr as alias)', () => {
    updateFile(
      `
      table users (
        id int,
        name text,
        age int,
        age >= 18 as is_adult
      )
    `,
      'models.gsql',
    )

    expect('from users select name where is_adult').toRenderSql('select users.name as name from users as users where (users.age>=18)')
  })

  it('has correct precedence between binary and logic expressions', () => {
    updateFile(
      `
      table flights (
        cancelled text,
        diverted text,
        is_cancelled_or_diverted: cancelled = 'Y' or diverted = 'Y'
      )
    `,
      'flights.gsql',
    )

    expect('from flights select is_cancelled_or_diverted').toHaveNoErrors()
  })

  it('supports parens on RHS of comparison', () => {
    updateFile(
      `
      table t (
        a int,
        b int,
        c: a = (b)
      )
    `,
      'parens.gsql',
    )
    expect('from t select c').toHaveNoErrors()
  })

  it('infers correct type for min/max', () => {
    expect('from users select min(created_at)').toHaveNoErrors()
    expect('from users select extract(year from min(created_at))').toHaveNoErrors()
  })

  it('supports standard functions in bigquery', () => {
    // BigQuery uses a different dialect than the StandardSQL that many use in Malloy. Ensure that we're loading standard fns into bigquery
    setGlobalConfig({root: '', bigquery: {}})
    expect('from users select floor(age) as floored_age').toRenderSql('select floor(users.age) as floored_age from `users` as users')
  })

  it('renders window order expressions with BigQuery identifiers', () => {
    setGlobalConfig({root: '', bigquery: {}})
    expect('from orders select row_number() over (order by amount desc) as rn').toRenderSql('select row_number() OVER (ORDER BY orders.amount DESC) as rn from `orders` as orders')
  })

  it('renders window frames in Snowflake with unquoted identifiers', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect('from orders select sum(amount) over (order by id rows between unbounded preceding and current row) as running_amount').toRenderSql(
      'SELECT sum(orders.AMOUNT) OVER (ORDER BY orders.ID ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_amount FROM ORDERS as orders',
    )
  })

  it('renders Snowflake pXX partition windows', () => {
    setGlobalConfig({dialect: 'snowflake', root: ''})
    expect('from orders select id, p50(amount) over (partition by user_id) as p50_by_user order by id').toRenderSql(
      'SELECT orders.id as id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY orders.amount) OVER (PARTITION BY orders.user_id) as p50_by_user FROM ORDERS as orders ORDER BY 1 asc NULLS LAST',
      {preserveCase: true},
    )
  })

  it('renders clickhouse pXX aggregates and windows', () => {
    setGlobalConfig({dialect: 'clickhouse', root: ''})
    expect('from orders select p50(amount) as median_amount').toRenderSql('SELECT quantile(0.5)(orders.amount) as median_amount FROM orders as orders')
    expect('from orders select id, p50(amount) over (partition by user_id) as p50_by_user order by id').toRenderSql(
      'SELECT orders.id as id, quantile(0.5)(orders.amount) OVER (PARTITION BY orders.user_id) as p50_by_user FROM orders as orders ORDER BY 1 asc NULLS LAST',
    )
  })

  it('supports cast() expressions', () => {
    expect('from users select cast(age as varchar)').toRenderSql('select CAST(users.age AS VARCHAR) as col_0 from users as users')
    expect('from users select cast(age as float64)').toRenderSql('select CAST(users.age AS FLOAT64) as col_0 from users as users')
    expect('from users select cast(name as array<string>)').toRenderSql('select CAST(users.name AS ARRAY<STRING>) as col_0 from users as users')

    setGlobalConfig({dialect: 'clickhouse', root: ''})
    expect('from users select cast(age as float64)').toRenderSql('SELECT CAST(users.age AS Float64) as col_0 FROM users as users')
    expect('from users select cast(name as array<string>)').toRenderSql('SELECT CAST(users.name AS Array(VARCHAR)) as col_0 FROM users as users')
  })

  it('supports :: cast syntax', () => {
    expect('from users select age::VARCHAR').toRenderSql('select CAST(users.age AS VARCHAR) as col_0 from users as users')
    expect('from users select name::int').toRenderSql('select CAST(users.name AS INT) as col_0 from users as users')
    expect('from users select name::array<string>').toRenderSql('select CAST(users.name AS ARRAY<STRING>) as col_0 from users as users')
  })

  it('reports diagnostic for invalid cast type', () => {
    expect('from users select cast(age as invalidtype)').toHaveDiagnostic(/Unsupported cast type: invalidtype/i)
    expect('from users select cast(name as array<array<string>>) ').toHaveDiagnostic(/nested arrays are not supported/i)
  })

  it('supports cast in expressions', () => {
    expect('from users select cast(age as varchar) = name').toRenderSql('select CAST(users.age AS VARCHAR)=users.name as col_0 from users as users')
  })

  it('normalizes clickhouse warehouse types for schema output', () => {
    expect(formatType(parseWarehouseFieldType('Nullable(Float64)').type)).toBe('number')
    expect(formatType(parseWarehouseFieldType('LowCardinality(String)').type)).toBe('string')
    expect(formatType(parseWarehouseFieldType("Enum8('CSH' = 1, 'CRE' = 2)").type)).toBe('string')
    expect(formatType(parseWarehouseFieldType('Array(String)').type)).toBe('array<string>')
  })

  it('preserves array element types through computed fields, views, and generic array returns', () => {
    clearWorkspace()
    updateFile(
      `
      table events (
        id int
        tags array<string>
        tag_copy: tags
      )

      table event_tags as (
        from events
        select id, tags, tag_copy, list(id) as ids
      )
    `,
      'arrays.gsql',
    )
    analyze()

    let events = getTable('events')!
    let eventTags = getTable('event_tags')!
    expect(formatType(events.columns.find(col => col.name == 'tags')!.type)).toBe('array<string>')
    expect(formatType(events.columns.find(col => col.name == 'tag_copy')!.type)).toBe('array<string>')
    expect(formatType(eventTags.columns.find(col => col.name == 'tags')!.type)).toBe('array<string>')
    expect(formatType(eventTags.columns.find(col => col.name == 'tag_copy')!.type)).toBe('array<string>')
    expect(formatType(eventTags.columns.find(col => col.name == 'ids')!.type)).toBe('array<number>')
  })

  it('ignores comments within table definitions', () => {
    // Comments should be skipped and not interfere with expression parsing
    expect(`table test (
      id INT64
      computed: id / 2
      -- this is a comment
      #units=usd
      name STRING
    ); from test select id`).toRenderSql('select test.id as id from test as test')
  })

  it('allows a single join many aggregate and a join one aggregate', () => {
    clearWorkspace()
    setGlobalConfig({root: ''})
    updateFile(
      `
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
    `,
      'fanout_test.gsql',
    )

    expect('from customers select name, sum(purchases.amount)').toHaveNoErrors()
    expect('from purchases select customers.name, sum(amount)').toHaveNoErrors()
  })

  it('reports fanout when an aggregate query mixes base and joined grains', () => {
    expect('from users select name, avg(age), sum(orders.amount)').toHaveDiagnostic(/Aggregate expression `avg\(age\)` is fanned out by join to table `orders`/i)
  })

  it('reports a chasm trap when a base-grain aggregate is combined with sibling join many aggregates', () => {
    expect('from users select name, avg(age), sum(orders.amount), sum(payments.amount)').toHaveDiagnostic(/Join graph creates a chasm trap/i)
  })

  it('allows the base and fanout grain query after separating the aggregates', () => {
    expect(`
      with user_stats as (from users select name, avg(age) as avg_age),
      order_stats as (from users select name, sum(orders.amount) as total_amount)
      from user_stats
      left join order_stats on order_stats.name = user_stats.name
      select user_stats.name, avg_age, total_amount
    `).toHaveNoErrors()
  })

  it('reports a chasm trap when an aggregate query mixes sibling join many grains', () => {
    expect('from users select name, sum(orders.amount), sum(payments.amount)').toHaveDiagnostic(/Join graph creates a chasm trap/i)
  })

  it('allows the sibling fanout query after aggregating each branch separately', () => {
    expect(`
      with order_stats as (from users select name, sum(orders.amount) as order_amount),
      payment_stats as (from users select name, sum(payments.amount) as payment_amount)
      from order_stats
      left join payment_stats on payment_stats.name = order_stats.name
      select order_stats.name, order_amount, payment_amount
    `).toHaveNoErrors()
  })

  it('allows aggregate query dimensions when they match the aggregate grain', () => {
    expect('from users select orders.status, sum(orders.amount)').toHaveNoErrors()
  })

  it('rejects aggregate query dimensions whose grain does not match the aggregates', () => {
    expect('from users select orders.status, avg(age)').toHaveDiagnostic(/Aggregate expression `avg\(age\)` is fanned out by join to table `orders`/i)
  })

  it('reports a fanout diagnostic when an aggregate query mixes ancestor and descendant grains', () => {
    expect('from users select name, sum(orders.amount), sum(orders.order_items.quantity)').toHaveDiagnostic(
      /Aggregate expression `sum\(orders\.amount\)` is fanned out by join to table `order_items`/i,
    )
  })

  it('reports join-graph fanout when a base-grain aggregate mixes with ancestor and descendant grains', () => {
    expect('from users select name, avg(age), sum(orders.amount), sum(orders.order_items.quantity)').toHaveDiagnostic(
      /One or more aggregate expressions fanned out by join graph \(base, orders, orders\.order_items\)/i,
    )
  })

  it('allows the ancestor and descendant query after aggregating each grain separately', () => {
    expect(`
      with order_stats as (from users select name, sum(orders.amount) as order_amount),
      item_stats as (from users select name, sum(orders.order_items.quantity) as item_quantity)
      from order_stats
      left join item_stats on item_stats.name = order_stats.name
      select order_stats.name, order_amount, item_quantity
    `).toHaveNoErrors()
  })

  it('treats count(id) as distinct-safe when it mixes with a fanout grain', () => {
    expect('from users select name, count(id), sum(orders.order_items.quantity)').toHaveNoErrors()
  })

  it('reports fanout when count(*) mixes with a fanout grain', () => {
    expect('from users select name, count(*), sum(orders.order_items.quantity)').toHaveDiagnostic(/Aggregate expression `count\(\*\)` is fanned out by join to table `order_items`/i)
  })

  it('does not apply fanout protection to explicit joins', () => {
    expect(`
      from users
      join orders on orders.user_id = users.id
      join payments on payments.user_id = users.id
      select name, sum(orders.amount), sum(payments.amount)
    `).toHaveNoErrors()

    expect(`
      from orders
      join users on (users.id = orders.user_id and users.name is not null)
      select users.name, sum(amount)
    `).toHaveNoErrors()

    expect(`
      with order_stats as (
        from users
        join orders on orders.user_id = users.id
        select name, sum(orders.amount) as order_amount
      ),
      payment_stats as (
        from users
        join payments on payments.user_id = users.id
        select name, sum(payments.amount) as payment_amount
      )
      from order_stats
      left join payment_stats on payment_stats.name = order_stats.name
      select order_stats.name, order_amount, payment_amount
    `).toHaveNoErrors()
  })

  it('allows base-grain aggregates to be weighted by explicit joins', () => {
    expect(`
      from users
      join orders on orders.user_id = users.id
      select name, avg(age), sum(orders.amount)
    `).toHaveNoErrors()
  })

  it('allows weighted semantics when the joined rowset is materialized first', () => {
    expect(`
      with joined as (
        from users
        join orders on orders.user_id = users.id
        join order_items on order_items.order_id = orders.id
        select name, age, quantity
      )
      from joined select name, avg(age), sum(quantity)
    `).toHaveNoErrors()
  })

  it('treats unnest as a fanout grain in aggregate queries', () => {
    expect(`
      table events (id int, tags array<string>)
      from events
      cross join unnest(tags) as tag
      select avg(id), sum(length(tag))
    `).toHaveDiagnostic(/aggregate expression `avg\(id\)` is fanned out by join to table `tag`/i)
  })

  it('handles computed columns with chained joins', () => {
    clearWorkspace()
    setGlobalConfig({root: ''})
    updateFile(
      `
      table countries (id int, name string)
      table users (id int, country_id int, join one countries on countries.id = country_id)
      table orders (id int, user_id int, join one users on users.id = user_id, user_country: users.countries.name)
    `,
      'chain.gsql',
    )

    expect('from orders select user_country').toRenderSql(
      'select (users_countries.name) as user_country from orders as orders left join users as users on users.id=orders.user_id left join countries as users_countries on users_countries.id=users.country_id',
    )
  })

  // When the same table is joined multiple times with different aliases, each reference
  // to a computed column uses the correct alias for that join instance.
  it('handles computed columns with multiple joins to same table', () => {
    clearWorkspace()
    setGlobalConfig({root: ''})
    updateFile(
      `
      table orders (id int, user_id int, amount int, discounted: amount * 0.9)
      table users (
        id int
        join many orders as recent_orders on recent_orders.user_id = id
        join many orders as old_orders on old_orders.user_id = id
      )
    `,
      'multi_join.gsql',
    )

    expect('from users select recent_orders.discounted, old_orders.discounted').toRenderSql(
      'select (recent_orders.amount*0.9) as recent_orders_discounted, (old_orders.amount*0.9) as old_orders_discounted from users as users left join orders as recent_orders on recent_orders.user_id=users.id left join orders as old_orders on old_orders.user_id=users.id',
    )
  })

  it('supports subqueries in FROM', () => {
    expect('from (from users where age > 20 select id, name) as adults select name').toRenderSql(
      'select adults.name as name from ( select users.id as id, users.name as name from users as users where users.age>20 ) as adults',
    )
  })

  it('supports subqueries in JOIN', () => {
    expect(`from users
      join (from orders select user_id, sum(amount) as total group by user_id) as order_totals on order_totals.user_id = users.id
      select users.name as name, order_totals.total as total`).toRenderSql(
      'select users.name as name, order_totals.total as total from users as users inner join ( select orders.user_id as user_id, sum(orders.amount) as total from orders as orders group by 1 order by 2 desc nulls last ) as order_totals on order_totals.user_id=users.id',
    )
  })

  it('supports subqueries in IN expressions', () => {
    expect('from users where id in (from orders where amount > 10 select user_id) select id').toRenderSql(
      'select users.id as id from users as users where users.id in (select orders.user_id as user_id from orders as orders where orders.amount>10)',
    )
  })

  it('supports scalar subquery expressions in WHERE', () => {
    expect('from users where age > (from users select avg(age)) select id').toRenderSql(
      'select users.id as id from users as users where users.age>(select avg(users.age) as col_0 from users as users)',
    )
  })

  it('supports CTEs', async () => {
    let q = `with
      high_value as (from orders where amount >= 40 select id, user_id, amount),
      hv_users as (from high_value select user_id)
      from hv_users select user_id order by user_id`
    expect(q).toRenderSql(
      'with high_value as ( select orders.id as id, orders.user_id as user_id, orders.amount as amount from orders as orders where orders.amount>=40 ), hv_users as ( select high_value.user_id as user_id from high_value as high_value ) select hv_users.user_id as user_id from hv_users as hv_users order by 1 asc nulls last',
    )
    await expect(q).toReturnRows([1], [2])
  })

  it('CTE shadows existing table names', () => {
    // CTE named "orders" should shadow the real orders table
    expect('with orders as (from users select id, name) from orders select id, name order by id').toRenderSql(
      'with orders as ( select users.id as id, users.name as name from users as users ) select orders.id as id, orders.name as name from orders as orders order by 1 asc nulls last',
    )
  })

  it('supports nested CTEs referencing earlier siblings', () => {
    // The second CTE's inner query has its own WITH that references the first CTE
    expect(`with
      completed as (from orders where status = 'completed' select user_id, amount),
      summary as (with totals as (from completed select user_id, sum(amount) as total) from totals select user_id, total)
      from summary select user_id, total order by user_id`)
      .toRenderSql(`with completed as ( select orders.user_id as user_id, orders.amount as amount from orders as orders where orders.status='completed' ),
        summary as ( with totals as ( select completed.user_id as user_id, sum(completed.amount) as total from completed as completed group by 1 order by 2 desc nulls last ) select totals.user_id as user_id, totals.total as total from totals as totals )
        select summary.user_id as user_id, summary.total as total from summary as summary order by 1 asc nulls last`)
  })
})
