---
title: Product Explorer
---

Select filters to explore product performance by category, brand, and time.

<Row>
  <Dropdown name="category" title="Category" data="category_options" allowDeselect="true"/>
  <Dropdown name="brand" title="Brand" data="brand_options" allowDeselect="true"/>
  <DateRange name="daterange" label="Date Range"/>
</Row>

```sql category_options
from products select distinct category as value, category as label order by 2 asc
```

```sql brand_options
from products select distinct brand as value, brand as label order by 2 asc
```

```sql filtered_kpis
from order_items select date_trunc(created_at, week) as week, revenue, gross_profit, gross_margin_pct, units_sold as units
where products.category = coalesce($category, products.category) and products.brand = coalesce($brand, products.brand) and created_at >= coalesce($daterange_start, created_at) and created_at <= coalesce($daterange_end, created_at)
order by 1 asc
```

<Row>
  <AreaChart data="filtered_kpis" title="Revenue over Time" x="week" y="revenue"/>
  <LineChart data="filtered_kpis" title="Gross Margin % over Time" x="week" y="gross_margin_pct"/>
</Row>

```sql top_products_filtered
from order_items select products.name, units_sold, revenue as product_revenue, gross_margin_pct, return_rate
where products.category = coalesce($category, products.category) and products.brand = coalesce($brand, products.brand)
order by 3 desc limit 20
```

<Table data="top_products_filtered" title="Top Products (Filtered)"/>

```sql category_breakdown
from order_items select products.category, units_sold as units, revenue, gross_margin_pct
where products.brand = coalesce($brand, products.brand)
group by 1 order by 2 desc limit 20
```

<Row>
  <BarChart data="category_breakdown" title="Units by Category" x="products_category" y="units" swapXY="true"/>
  <PieChart data="category_breakdown" title="Revenue Share by Category" category="products_category" value="revenue"/>
</Row>
