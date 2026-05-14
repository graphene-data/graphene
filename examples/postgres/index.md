---
title: Postgres Sales Overview
layout: dashboard
---

Postgres sample dashboard over `public.customers`, `public.orders`, and `public.order_items`.

<Row>
  <BigValue data=orders value=count(*) title="Orders" fmt=num0 />
  <BigValue data=orders value=sum(total) title="Revenue" fmt=usd2 />
  <BigValue data=orders value=p50(total) title="Median Order" fmt=usd2 />
</Row>

```gsql revenue_by_week
from orders
where status = 'completed'
select
  date_trunc('week', order_date) as order_week,
  count() as orders,
  sum(total) as revenue
group by 1
order by 1
```

<LineChart title="Weekly Completed Revenue" data=revenue_by_week x=order_week y=revenue y2=orders />

```gsql revenue_by_region
from customers
select
  region,
  count(orders.id) as orders,
  total_revenue
group by 1
order by 3 desc
```

<BarChart title="Revenue by Region" data=revenue_by_region x=region y=total_revenue />

```gsql customer_tags
from customers
cross join unnest(tags) as tag
select
  tag,
  count(id) as customers
group by 1
order by 2 desc
```

<BarChart title="Customer Tags" data=customer_tags x=tag y=customers />
