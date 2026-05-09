---
title: Time-axis tick alignment
---

These charts exercise the integer-tick logic in `inferAxisFromField` for `timePart === 'year'`
and the various `timeOrdinal` cases. The goal is evenly-spaced labels with no stub at the boundary.

## timePart: year (range 5)

Range 2000–2005, where ECharts' generic value-axis defaults produce 2000/2002/2004/2005.

```sql by_year
from flights select
  extract(year from dep_time) as year,
  count() as flights
group by 1
order by 1
```

<LineChart data=by_year x=year y=flights title="Flights by year" />

## timeOrdinal: hour_of_day (range 0–23)

Domain `[0, 23]` is prime — no clean divisor in the candidate list, so the helper picks the
smallest step that fits within ~8 ticks.

```sql by_hour
from flights select
  extract(hour from dep_time) as hour,
  count() as flights
group by 1
order by 1
```

<BarChart data=by_hour x=hour y=flights title="Flights by hour of day" />

## timeOrdinal: month_of_year (range 1–12)

Range fits in `targetMax`, so every month gets a label.

```sql by_month
from flights select
  extract(month from dep_time) as month,
  count() as flights
group by 1
order by 1
```

<LineChart data=by_month x=month y=flights title="Flights by month of year" />

## timeOrdinal: quarter_of_year (range 1–4)

Tiny range — every quarter labeled.

```sql by_quarter
from flights select
  extract(quarter from dep_time) as quarter,
  count() as flights
group by 1
order by 1
```

<BarChart data=by_quarter x=quarter y=flights title="Flights by quarter" />

## timeOrdinal: day_of_month (range 1–31)

Range 30 — divisor 5 yields 7 evenly-spaced ticks (1, 6, 11, 16, 21, 26, 31).

```sql by_dom
from flights select
  extract(day from dep_time) as day_of_month,
  count() as flights
group by 1
order by 1
```

<LineChart data=by_dom x=day_of_month y=flights title="Flights by day of month" />

## timeOrdinal: day_of_year (range 1–366)

Large range — picks a coarse step (~50) so labels stay readable.

```sql by_doy
from flights select
  extract(dayofyear from dep_time) as day_of_year,
  count() as flights
group by 1
order by 1
```

<LineChart data=by_doy x=day_of_year y=flights title="Flights by day of year" />

## timeOrdinal: week_of_year (range 1–53)

The original problem case for ordinals — range 52 has limited clean divisors.

```sql by_week
from flights select
  extract(week from dep_time) as week_of_year,
  count() as flights
group by 1
order by 1
```

<LineChart data=by_week x=week_of_year y=flights title="Flights by week of year" />

## timeOrdinal: dow (range 0–6 in duckdb)

DuckDB returns 0–6 for `extract(dow ...)` → `dow_0s`. Every day labeled.

```sql by_dow
from flights select
  extract(dow from dep_time) as dow,
  count() as flights
group by 1
order by 1
```

<BarChart data=by_dow x=dow y=flights title="Flights by day of week" />

## Combination: y2 with year axis (regression check from issue #262)

Verifies the fix doesn't break the dual-y-axis tick alignment.

```sql structural_growth
from flights select
  extract(year from dep_time) as year,
  count(distinct concat(origin, '-', destination)) as unique_routes,
  count(distinct origin) as unique_origins,
  avg(distance) as avg_distance,
  count() as total_flights
group by 1
order by 1
```

<LineChart
  title="Routes & Origins (left) vs Avg Distance (right)"
  data=structural_growth
  x=year
  y="unique_routes,unique_origins"
  y2=avg_distance
/>

<BarChart
  title="Total Flights (bars) vs Avg Distance (line)"
  data=structural_growth
  x=year
  y=total_flights
  y2=avg_distance
/>
