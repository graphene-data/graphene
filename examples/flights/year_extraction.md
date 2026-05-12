---
title: Year Extraction Comparison
layout: dashboard
---

This page compares two ways to bucket flights by departure year. `extract(year)` returns a number, while `date_trunc('year')` returns a date/timestamp bucket.

```gsql flights_by_extracted_year
from flights
where not is_cancelled
select extract(year from dep_time) as year, count() as flight_count
order by year
```

```gsql flights_by_extracted_year_int
from flights
where not is_cancelled
select extract(year from dep_time)::integer as year, count() as flight_count
order by year
```

```gsql flights_by_truncated_year
from flights
where not is_cancelled
select date_trunc('year', dep_time) as year_start, count() as flight_count
order by year_start
```

<Row>
  <BarChart title="Flights by extract(year)" data=flights_by_extracted_year x=year y=flight_count />
  <BarChart title="Flights by extract(year)::integer" data=flights_by_extracted_year_int x=year y=flight_count />
  <!--<BarChart title="Flights by date_trunc('year')" data=flights_by_truncated_year x=year_start y=flight_count />-->
</Row>
