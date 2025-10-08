# Airport Delay Analysis

Analysis of which airports have the worst departure and arrival delays.

```gsql worst_delays_overall
from flights
select
  origin_airport.code,
  origin_airport.full_name,
  avg(dep_delay) as avg_departure_delay,
  avg(arr_delay) as avg_arrival_delay,
  count(*) as flight_count
where dep_delay is not null and arr_delay is not null
group by origin_airport.code, origin_airport.full_name
order by avg_departure_delay desc
limit 15
```

```gsql worst_delays_major_airports
from flights
select
  origin_airport.code,
  origin_airport.full_name,
  avg(dep_delay) as avg_departure_delay,
  avg(arr_delay) as avg_arrival_delay,
  count(*) as flight_count
where dep_delay is not null
  and arr_delay is not null
  and origin_airport.is_major = true
group by origin_airport.code, origin_airport.full_name
having count(*) >= 100
order by avg_departure_delay desc
limit 15
```

## Worst Delays Overall
<BarChart data="worst_delays_overall" x="code" y="avg_departure_delay" title="Average Departure Delays (All Airports)" />

## Worst Delays Among Major Airports
<BarChart data="worst_delays_major_airports" x="code" y="avg_departure_delay" title="Average Departure Delays (Major Airports Only)" />

## Key Findings

**Worst delays overall:**
- **BQK (Glynco Jetport)**: 85 minutes average departure delay
- **FLO (Florence Regional)**: 80 minutes average departure delay
- **EUG (Mahlon Sweet Field)**: 71.4 minutes average departure delay

**Worst delays among major airports:**
- **LEX (Blue Grass)**: 16.2 minutes average departure delay
- **MGM (Montgomery Regional)**: 15.6 minutes average departure delay
- **ORD (Chicago O'Hare)**: 11.4 minutes average departure delay (highest volume with 14,214 flights)
- **PHL (Philadelphia International)**: 11.2 minutes average departure delay
- **ATL (Atlanta International)**: 11.0 minutes average departure delay (17,875 flights)

Chicago O'Hare and Atlanta, despite being the busiest airports in the dataset, maintain relatively reasonable delay times considering their traffic volume.