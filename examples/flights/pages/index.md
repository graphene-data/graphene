---
title: Flight Delay Analysis Dashboard
---

# Flight Delay Analysis Dashboard

This dashboard analyzes flight delay patterns from FAA data to uncover insights about airline performance, geographic patterns, and temporal trends.

## Overall Delay Statistics

```sql delay_stats
  from flights 
  select 
    count(*) as total_flights,
    avg(dep_delay) as avg_departure_delay,
    avg(arr_delay) as avg_arrival_delay,
    avg(abs(dep_delay)) as avg_abs_departure_delay,
    avg(abs(arr_delay)) as avg_abs_arrival_delay,
    count(where dep_delay > 0) as delayed_departures,
    count(where arr_delay > 0) as delayed_arrivals
  where dep_delay is not null and arr_delay is not null;
```

**Key Insights:**
- Total flights analyzed: {delay_stats.total_flights}
- Average departure delay: {delay_stats.avg_departure_delay:.1f} minutes
- Average arrival delay: {delay_stats.avg_arrival_delay:.1f} minutes
- {delay_stats.delayed_departures} flights had departure delays
- {delay_stats.delayed_arrivals} flights had arrival delays

## Carrier Performance Comparison

```sql carrier_delays
  from flights 
  select 
    carriers.name,
    avg(dep_delay) as avg_dep_delay,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count,
    avg(distance) as avg_distance
  where dep_delay is not null and arr_delay is not null
  group by carriers.name
  order by avg_dep_delay desc;
```

<BarChart
  data={carrier_delays}
  title="Average Departure Delays by Carrier"
  x="name"
  y="avg_dep_delay"
  color="avg_dep_delay"
/>

<BarChart
  data={carrier_delays}
  title="Average Arrival Delays by Carrier"
  x="name"
  y="avg_arr_delay"
  color="avg_arr_delay"
/>

## Delay Patterns by Time of Day

```sql hourly_delays
  from flights 
  select 
    hour(dep_time) as hour_of_day,
    avg(dep_delay) as avg_dep_delay,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count
  where dep_delay is not null and arr_delay is not null
  group by hour_of_day
  order by hour_of_day;
```

<LineChart
  data={hourly_delays}
  title="Average Delays by Hour of Day"
  x="hour_of_day"
  y="avg_dep_delay"
  series="Delay Type"
  values={["avg_dep_delay", "avg_arr_delay"]}
/>

## Geographic Delay Analysis

```sql airport_delays
  from flights 
  select 
    origin_airport.full_name as airport_name,
    origin_airport.city as city,
    origin_airport.state as state,
    avg(dep_delay) as avg_dep_delay,
    count(*) as flight_count
  where dep_delay is not null
  group by airport_name, city, state
  having flight_count > 10
  order by avg_dep_delay desc
  limit 15;
```

<BarChart
  data={airport_delays}
  title="Worst Departure Delays by Airport (Top 15)"
  x="airport_name"
  y="avg_dep_delay"
  color="avg_dep_delay"
/>

## Delay vs. Distance Relationship

```sql delay_distance
  from flights 
  select 
    round(distance/100)*100 as distance_bucket,
    avg(dep_delay) as avg_dep_delay,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count
  where dep_delay is not null and arr_delay is not null
  group by distance_bucket
  having flight_count > 5
  order by distance_bucket;
```

<ScatterChart
  data={delay_distance}
  title="Delay Patterns by Flight Distance"
  x="distance_bucket"
  y="avg_dep_delay"
  size="flight_count"
  color="avg_dep_delay"
/>

## Delay Propagation Analysis

```sql delay_correlation
  from flights 
  select 
    round(dep_delay/10)*10 as dep_delay_bucket,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count
  where dep_delay is not null and arr_delay is not null
  group by dep_delay_bucket
  having flight_count > 5 and dep_delay_bucket between -30 and 120
  order by dep_delay_bucket;
```

<LineChart
  data={delay_correlation}
  title="How Departure Delays Affect Arrival Delays"
  x="dep_delay_bucket"
  y="avg_arr_delay"
  size="flight_count"
/>

## Seasonal and Temporal Patterns

```sql monthly_delays
  from flights 
  select 
    month(dep_time) as month,
    avg(dep_delay) as avg_dep_delay,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count
  where dep_delay is not null and arr_delay is not null
  group by month
  order by month;
```

<BarChart
  data={monthly_delays}
  title="Average Delays by Month"
  x="month"
  y="avg_dep_delay"
  color="avg_dep_delay"
/>

## Aircraft Type Impact on Delays

```sql aircraft_delays
  from flights 
  select 
    aircraft.model.manufacturer as manufacturer,
    avg(dep_delay) as avg_dep_delay,
    avg(arr_delay) as avg_arr_delay,
    count(*) as flight_count
  where dep_delay is not null and arr_delay is not null
  group by manufacturer
  having flight_count > 20
  order by avg_dep_delay desc;
```

<BarChart
  data={aircraft_delays}
  title="Average Delays by Aircraft Manufacturer"
  x="manufacturer"
  y="avg_dep_delay"
  color="avg_dep_delay"
/>
