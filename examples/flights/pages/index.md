---
title: Flights
---

```sql flights
  from flights select carriers.name, avg(distance) as avg_dist, avg(seats_per_flight);
```

<BarChart
  data={flights}
  title="By Carrier"
  x=name
  y="avg_dist"
  swapXY=true
/>
