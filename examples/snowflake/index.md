---
layout: dashboard
---

# NYC Yellow Taxi Overview

January 2025 yellow taxi trips published by the [NYC Taxi and Limousine Commission](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).

<Row>
  <BigValue data=yellow_trips value=count(*) title="Trips" />
  <BigValue data=yellow_trips value=avg_total_amount title="Avg Total" />
  <BigValue data=yellow_trips value=median_total_amount title="Median Total" />
  <BigValue data=yellow_trips value=avg_tip_amount title="Avg Tip" />
</Row>

## Trips by Day

```gsql daily_trips
from yellow_trips
select
  date_trunc('day', pickup_datetime) as pickup_day,
  count(*) as trips,
  median_total_amount
order by pickup_day
```

<LineChart data=daily_trips x=pickup_day y=trips y2=median_total_amount />

## Payment Methods

```gsql payment_mix
from yellow_trips
select payment_method, count(*) as trips
order by trips desc
```

<BarChart data=payment_mix x=payment_method y=trips />

## Pickup Activity

```gsql pickup_boroughs
from yellow_trips
select pickup_zone.borough, count(*) as trips
where pickup_zone.borough != 'Unknown'
order by trips desc
```

<BarChart data=pickup_boroughs x=borough y=trips />

```gsql top_pickup_zones
from yellow_trips
select
  pickup_zone.borough,
  pickup_zone.zone,
  count(*) as trips,
  avg(trip_distance) as avg_distance,
  avg_total_amount
where pickup_zone.borough != 'Unknown'
order by trips desc
limit 20
```

<Table data=top_pickup_zones title="Top Pickup Zones" rows=20>
  <Column id=borough />
  <Column id=zone />
  <Column id=trips />
  <Column id=avg_distance title="Avg Distance" />
  <Column id=avg_total_amount title="Avg Total" />
</Table>
