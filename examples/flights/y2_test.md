---
title: Y2 Axis Tick Alignment Test
---

This page reproduces the dual-y-axis scenario from issue #262 to verify that the secondary axis tick lines align with the primary axis tick lines.

```sql structural_growth
from flights select
  extract(year from dep_time)::varchar as year,
  count(distinct concat(origin, '-', destination)) as unique_routes,
  count(distinct origin) as unique_origins,
  avg(distance) as avg_distance,
  count() as total_flights
group by 1
order by 1
```

## LineChart with y2

<LineChart
  title="Routes & Origins (left) vs Avg Distance (right)"
  data=structural_growth
  x=year
  y={['unique_routes','unique_origins']}
  y2=avg_distance
/>

## BarChart with y2 line overlay

<BarChart
  title="Total Flights (bars) vs Avg Distance (line)"
  data=structural_growth
  x=year
  y=total_flights
  y2=avg_distance
/>

## AreaChart with y2

<AreaChart
  title="Unique Routes (area) vs Avg Distance (line)"
  data=structural_growth
  x=year
  y=unique_routes
  y2=avg_distance
/>
