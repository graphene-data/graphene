---
title: Evidence flights
---

```sql flights
  from flights select carrier, avg(distance) as avg_dist, avg(seats_per_flight);
```

create table carriers as select * from read_parquet('~/co/datar/examples/flights/carriers.parquet');

<BarChart
  data={flights}
  title="Sales by Month, {inputs.category.label}"
  x=carrier
  y="avg_dist"
/>
