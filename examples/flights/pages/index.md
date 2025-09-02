# Flight Delay Analysis

## Average Departure Delay by Airport

This chart shows the average departure delay in minutes for each airport, based on flight data.

```delay_per_origin
select origin, origin_airport.full_name as origin_full_name, avg(dep_delay) as avg_delay from flights group by 1, 2 limit 20
```

<BarChart 
  data={delay_per_origin}
  x=origin
  labels=true
  labelPosition=inside
  y=avg_delay
  swapXY=true
  title="Most Delayed Airports"
  subtitle="Top 20 airports by average delay (minutes)"
/>
