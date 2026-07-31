# NYC Taxi Tables

## Yellow Trips

```gsql all_yellow_trips
from yellow_trips
select
  pickup_datetime,
  pickup_zone.zone as pickup_zone,
  dropoff_zone.zone as dropoff_zone,
  trip_distance,
  payment_method,
  total_amount
order by pickup_datetime
limit 20
```

<Table data=all_yellow_trips rows=20 compact=true />

## Taxi Zones

```gsql all_taxi_zones
from taxi_zones
select *
order by location_id
```

<Table data=all_taxi_zones rows=20 />
