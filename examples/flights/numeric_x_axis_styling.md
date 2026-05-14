---
title: Numeric X-Axis Styling
layout: dashboard
---

Regression coverage for the "vertical y-axis line + vertical gridlines on line /
area / bar charts" bug. The fix in #392 handled `extract(year)` and the
`timeOrdinal` family by reading column metadata, but the same chrome leaks back
in whenever a numeric x-axis lacks that metadata: window functions, integer
casts, math expressions, raw integer columns. None of the four charts below
should show a vertical y-axis line, vertical splitLines, or x-axis tick marks.

```gsql carrier_totals
from flights
select carrier, count() as flight_count
order by flight_count desc
```

```gsql carrier_rank
from carrier_totals
select row_number() over (order by flight_count desc) as rank, carrier, flight_count
order by rank
```

```gsql flights_per_dep_hour
from flights
where not is_cancelled
select extract(hour from dep_time)::integer as dep_hour, count() as flight_count
order by dep_hour
```

```gsql flights_per_distance_bucket
from flights
where not is_cancelled
select (floor(distance / 250) * 250)::integer as distance_bucket, count() as flight_count
order by distance_bucket
```

<Row>
  <LineChart title="Carriers ranked (row_number)" data=carrier_rank x=rank y=flight_count />
  <BarChart title="Carriers ranked (row_number)" data=carrier_rank x=rank y=flight_count />
</Row>

<Row>
  <LineChart title="Flights by hour-of-day (cast int)" data=flights_per_dep_hour x=dep_hour y=flight_count />
  <AreaChart title="Flights by 250-mi bucket" data=flights_per_distance_bucket x=distance_bucket y=flight_count />
</Row>
