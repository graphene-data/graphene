---
title: Product Explorer
---

Select filters to explore product performance by category, brand, and time.

<Row>
  <Select name="category" label="Category" allowDeselect="true"/>
  <Select name="brand" label="Brand" allowDeselect="true"/>
  <DateRange name="daterange" label="Date Range"/>
</Row>

```sql category_options
from products
select distinct category
order by 1 asc
;
```

```sql brand_options
from products
select distinct brand
order by 1 asc
;
```

<BindSelect name="category" data="category_options" optionLabel="category" optionValue="category"/>
<BindSelect name="brand" data="brand_options" optionLabel="brand" optionValue="brand"/>

```sql filtered_kpis
from order_items
select
  date_trunc(week, created_at) as week,
  sum(sale_price) as revenue,
  sum(sale_price - inventory_items.cost) as gross_profit,
  safe_divide(sum(sale_price - inventory_items.cost), sum(sale_price)) as gross_margin_pct,
  count(*) as units
where
  (${inputs.category} is null or products.category = ${inputs.category}) and
  (${inputs.brand} is null or products.brand = ${inputs.brand}) and
  (${inputs.daterange.start} is null or created_at >= ${inputs.daterange.start}) and
  (${inputs.daterange.end} is null or created_at < ${inputs.daterange.end})
order by 1 asc
;
```

<Row>
  <AreaChart data="filtered_kpis" title="Revenue over Time" x="week" y="revenue"/>
  <LineChart data="filtered_kpis" title="Gross Margin % over Time" x="week" y="gross_margin_pct"/>
</Row>

```sql top_products_filtered
from products
select
  name,
  units_sold,
  product_revenue,
  gross_margin_pct,
  return_rate
where
  (${inputs.category} is null or category = ${inputs.category}) and
  (${inputs.brand} is null or brand = ${inputs.brand})
order by 3 desc
limit 20
;
```

<Table data="top_products_filtered" title="Top Products (Filtered)"/>

```sql category_breakdown
from order_items
select
  products.category,
  count(*) as units,
  sum(sale_price) as revenue,
  safe_divide(sum(sale_price - inventory_items.cost), sum(sale_price)) as gross_margin_pct
where
  (${inputs.brand} is null or products.brand = ${inputs.brand})
group by 1
order by 2 desc
limit 20
;
```

<Row>
  <BarChart data="category_breakdown" title="Units by Category" x="products_category" y="units" swapXY="true"/>
  <PieChart data="category_breakdown" title="Revenue Share by Category" category="products_category" value="revenue"/>
</Row>

