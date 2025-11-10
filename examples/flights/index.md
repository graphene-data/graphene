# Flight Analytics Dashboard

A comprehensive dashboard showcasing flight data metrics from 2000-2005.

## Key Metrics

<Row>
  <BigValue data=flights value=count(*) title="Total Flights" fmt=num0 />
  <BigValue data=flights value=sum(miles_flown) title="Total Miles Flown" fmt=num0m />
  <BigValue data=flights value=on_time_departure_rate title="On-Time Departure Rate" fmt=pct1 />
  <BigValue data=flights value=on_time_arrival_rate title="On-Time Arrival Rate" fmt=pct1 />
</Row>

<Row>
  <BigValue data=flights value=cancellation_rate title="Cancellation Rate" fmt=pct2 />
  <BigValue data=flights value=diversion_rate title="Diversion Rate" fmt=pct2 />
  <BigValue data=flights value=avg(dep_delay) title="Avg Departure Delay (min)" fmt=num1 />
  <BigValue data=flights value=avg(arr_delay) title="Avg Arrival Delay (min)" fmt=num1 />
</Row>

```sql weekly_trends
select 
  date_trunc('week', dep_time) as week,
  cancellation_rate,
  diversion_rate,
  avg(dep_delay) as avg_dep_delay,
  avg(arr_delay) as avg_arr_delay,
  on_time_departure_rate,
  on_time_arrival_rate,
  count(*) as flight_count,
  avg(distance) as avg_distance
from flights
group by 1
order by 1 asc
```

## Trends over time

<Row>
  <LineChart title="Flight volume vs. average distance" 
    subtitle="Trending to more, shorter distance flights" 
    data=weekly_trends 
    x=week 
    y=flight_count 
    y2=avg_distance 
  />
  <LineChart title="Cancellation rate" 
    subtitle="9/11 is clearly shown with a spike in cancellations" 
    data=weekly_trends 
    x=week 
    y=cancellation_rate 
    yFmt=pct1 
  />
</Row>

## Carrier Comparison

```sql carrier_performance
select 
  carriers.name as carrier_name,
  count(*) as flight_count,
  on_time_departure_rate,
  1 - on_time_departure_rate as delayed_departure_rate,
  on_time_arrival_rate,
  1 - on_time_arrival_rate as delayed_arrival_rate,
  cancellation_rate,
  avg(dep_delay) as avg_departure_delay,
  avg(arr_delay) as avg_arrival_delay
from flights 
group by 1
order by 2 desc
```

<Row>
  <BarChart title="Average Departure Delay by Carrier (minutes)" 
    data=carrier_performance 
    x=carrier_name 
    y=avg_departure_delay 
    yAxisTitle="Minutes"
    y2=delayed_departure_rate
    y2Fmt=pct1
    y2SeriesType=line
    y2AxisTitle="% Flights Delayed"
  />
  <PieChart title="Flight Distribution by Carrier" 
    data=carrier_performance 
    category=carrier_name 
    value=flight_count 
  />
</Row>

<Table title="Carrier details" data=carrier_performance sort="flight_count desc" rows=25>
  <Column id=carrier_name />
  <Column id=flight_count />
  <Column id=on_time_departure_rate fmt=pct1 />
  <Column id=on_time_arrival_rate fmt=pct1 />
  <Column id=cancellation_rate fmt=pct2 />
  <Column id=avg_departure_delay fmt=num1 />
  <Column id=avg_arrival_delay fmt=num1 />
</Table>
