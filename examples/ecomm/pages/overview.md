---
title: E-commerce Overview
---

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
  <graphene-barchart
    data={kpis_by_day}
    title="Revenue by Day"
    x="day"
    y="revenue"
  />

  <graphene-barchart
    data={kpis_by_day}
    title="Gross Profit by Day"
    x="day"
    y="gross_profit"
  />
</Row>

<Row>
  <graphene-barchart
    data={kpis_by_day}
    title="Units by Day"
    x="day"
    y="units"
  />

  <graphene-barchart
    data={kpis_by_day}
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

<graphene-barchart
  data={revenue_by_category}
  title="Revenue by Category"
  x="products_category"
  y="revenue"
  swapXY=true
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

<graphene-barchart
  data={revenue_by_state}
  title="Top States by Revenue"
  x="users_state"
  y="revenue"
  swapXY=true
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
  <graphene-barchart
    data={orders_service}
    title="Average Order Value (Weekly)"
    x="week"
    y="aov"
  />
  <graphene-barchart
    data={orders_service}
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

<Tables data={top_products} title="Top Products"/>
