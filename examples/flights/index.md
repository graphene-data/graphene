# Flight Delay Analysis

## Average Departure Delay by Airport

This chart shows the average departure delay in minutes for each airport, based on flight data.

```sql delay_per_origin
select origin, origin_airport.full_name as origin_full_name, avg(dep_delay) as avg_delay from flights group by 1, 2 limit 20
```

<BarChart
  data="delay_per_origin"
  x="origin"
  labels="true"
  labelPosition="inside"
  y="avg_delay"
  swapXY="true"
  title="Most Delayed Airports"
  subtitle="Top 20 airports by average delay (minutes)"
/>

```sql delay_by_origin_carrier
from flights select
  origin,
  carrier,
  avg(dep_delay) as avg_delay
group by origin, carrier
order by origin, carrier
limit 200
```


<AreaChart
  data="delay_by_origin_carrier"
  x="origin"
  y="avg_delay"
  series="carrier"
  type="stacked"
  labels="false"
  title="Average Departure Delay by Origin and Carrier"
  subtitle="Stacked bars highlight which carriers drive delays at each airport"
/>


```sql sfo_delay_trend
from flights select
  dep_time as flight_time,
  dep_delay as dep_delay
where origin = 'SFO'
order by flight_time
limit 120
```


<LineChart
  data="sfo_delay_trend"
  x="flight_time"
  y="dep_delay"
  xType="time"
  markers="true"
  title="Departure Delays for Recent SFO Flights"
  subtitle="Ordered by flight time so spikes are easy to spot"
/>


```sql flights_by_carrier
from flights select carrier, count() as total_flights group by 1 order by total_flights desc
```

<!--<PieChart
  data="flights_by_carrier"
  category="carrier"
  value="total_flights"
  labels="true"
  labelContent="name-percent"
  title="Flight Share by Carrier"
  subtitle="Percentage of total flights in the sample"
/>-->
