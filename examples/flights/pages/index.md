---
title: Flights
---

```sql flights
  from flights select carriers.name, avg(distance) as avg_dist;
```

<BarChart
  data={flights}
  title="By Carrier"
  x=carriers_name
  y="avg_dist"
  swapXY=true
/>
