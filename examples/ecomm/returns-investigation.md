---
title: Returns Investigation
---

We suspect an increase in returns. This page documents a quick exploration to find drivers and quantify impact.

## Are returns increasing?

```sql returns_over_time
from orders select date_trunc(week, created_at) as week, return_rate, count() as orders
order by 1 asc
```

<Row>
  <LineChart data="returns_over_time" title="Return Rate Over Time" x="week" y="return_rate"/>
  <BarChart data="returns_over_time" title="Orders per Week" x="week" y="orders"/>
</Row>

Observation: Spikes in return rate coincide with dips in orders. Next, check product categories.

## Which categories drive returns?

```sql cat_return_rate
from order_items select products.category, return_rate, count() as units, revenue
order by 2 desc limit 25
```

<Row>
  <BarChart data="cat_return_rate" title="Return Rate by Category" x="products_category" y="return_rate" swapXY="true"/>
  <BarChart data="cat_return_rate" title="Units by Category" x="products_category" y="units" swapXY="true"/>
</Row>

## Are certain brands problematic within top categories?

```sql brand_returns
from order_items select products.category, products.brand, count_if(returned_at is not null) as returns, count() as units, return_rate
order by 5 desc limit 50
```

<Table data="brand_returns" title="Brand Return Hotspots"/>

Insight: Filter to the top offending category to dive deeper.

<Row>
  <Select name="focus_category" label="Focus Category" allowDeselect="true"/>
</Row>

```sql focus_category_options
from products select distinct category order by 1 asc
```

<BindSelect name="focus_category" data="focus_category_options" optionLabel="category" optionValue="category"/>

```sql brand_in_focus
from order_items select products.brand, count_if(returned_at is not null) as returns, count() as units, return_rate
where (${inputs.focus_category} is null or products.category = ${inputs.focus_category})
order by 4 desc limit 25
```

<Row>
  <BarChart data="brand_in_focus" title="Return Rate by Brand (Focus Category)" x="products_brand" y="return_rate" swapXY="true"/>
  <BarChart data="brand_in_focus" title="Returns vs Units (Focus Category)" x="products_brand" y="returns" swapXY="true"/>
</Row>

## Operational factors: shipping and delivery times

```sql ops_factors
from order_items select date_trunc(week, created_at) as week, fulfillment_time_days, delivery_time_days, return_rate
order by 1 asc
```

<Row>
  <LineChart data="ops_factors" title="Fulfillment Time vs Return Rate" x="week" y="fulfillment_time_days"/>
  <LineChart data="ops_factors" title="Delivery Time vs Return Rate" x="week" y="delivery_time_days"/>
</Row>

Narrative: Elevated fulfillment/delivery times may correlate with higher return rates; worth testing with more rigorous analysis.

## Where are returns concentrated geographically?

```sql returns_by_state
from order_items select users.state, count_if(returned_at is not null) as returns, return_rate
order by 3 desc limit 30
```

<Row>
  <BarChart data="returns_by_state" title="Return Rate by State" x="users_state" y="return_rate" swapXY="true"/>
  <BarChart data="returns_by_state" title="Returns by State" x="users_state" y="returns" swapXY="true"/>
</Row>

Conclusion: Prioritize QA with brands in the focus category, and investigate logistics where lead times trend upward.

