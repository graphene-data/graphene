---
title: E-commerce Overview
---

> This example uses [theLook eCommerce](https://console.cloud.google.com/marketplace/product/bigquery-public-data/thelook-ecommerce). To connect with Graphene, you'll need to set up [ADC local credentials](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)

[Product Explorer](product-explorer) | [Returns investigation](returns-investigation)

## KPI Summary

```sql kpis_by_day
from order_items
select
  date_trunc(day, created_at) as day,
  sum(sale_price) as revenue,
  sum(sale_price - inventory_items.cost) as gross_profit,
  safe_divide(sum(sale_price - inventory_items.cost), sum(sale_price)) as gross_margin_pct,
  count(*) as units
order by 1 asc
;
```

<Row>
  <AreaChart
    data="kpis_by_day"
    title="Revenue by Day"
    x="day"
    y="revenue"
  />

  <LineChart
    data="kpis_by_day"
    title="Gross Profit by Day"
    x="day"
    y="gross_profit"
  />
  
</Row>

<Row>
  <LineChart
    data="kpis_by_day"
    title="Units by Day"
    x="day"
    y="units"
  />

  <LineChart
    data="kpis_by_day"
    title="Gross Margin %"
    x="day"
    y="gross_margin_pct"
  />
</Row>

```sql revenue_by_category
from order_items
select
  products.category,
  sum(sale_price) as revenue,
  sum(sale_price - inventory_items.cost) as gross_profit,
  safe_divide(sum(sale_price - inventory_items.cost), sum(sale_price)) as gross_margin_pct,
  count(*) as units
order by 2 desc
limit 20
;
```

<BarChart
  data="revenue_by_category"
  title="Revenue by Category"
  x="products_category"
  y="revenue"
  swapXY="true"
/>

<PieChart
  data="revenue_by_category"
  title="Category Revenue Share"
  category="products_category"
  value="revenue"
/>

```sql revenue_by_state
from order_items
select
  users.state,
  sum(sale_price) as revenue,
  count(*) as units
order by 2 desc
limit 25
;
```

<BarChart
  data="revenue_by_state"
  title="Top States by Revenue"
  x="users_state"
  y="revenue"
  swapXY="true"
/>

```sql orders_service
from orders
select
  date_trunc(week, created_at) as week,
  aov,
  shipped_rate,
  delivered_rate,
  return_rate,
  order_cycle_time_days
order by 1 asc
;
```

<Row>
  <LineChart
    data="orders_service"
    title="Average Order Value (Weekly)"
    x="week"
    y="aov"
  />
  <LineChart
    data="orders_service"
    title="Return Rate (Weekly)"
    x="week"
    y="return_rate"
  />
</Row>

```sql top_products
from products
select
  name,
  units_sold,
  product_revenue,
  gross_margin_pct,
  return_rate
order by 3 desc
limit 15
;
```

<Table data="top_products" title="Top Products"/>

