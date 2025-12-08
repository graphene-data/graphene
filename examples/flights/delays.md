# Carrier Delay Deep-Dive

Focus on an individual carrier to see how their network performs, which hubs give them trouble, and when long delays are most common.

```sql carrier_options
from carriers select
  code,
  name
order by name
```

<Dropdown
  data=carrier_options
  name=carrier
  value=code
  label=name
  title="Carrier"
  defaultValue=EV
/>

```sql carrier_summary
from flights select
  carriers.name as carrier_name,
  count() as flights,
  avg_departure_delay as avg_departure_delay_minutes,
  avg_arrival_delay as avg_arrival_delay_minutes,
  avg(case when dep_delay > 15 then 1 else 0 end) as departing_over_15_rate,
  avg(case when arr_delay > 15 then 1 else 0 end) as arriving_over_15_rate,
  cancellation_rate,
  diversion_rate,
  avg(distance) as avg_distance_miles,
  avg(flight_time) as avg_flight_time_minutes
where carrier = $carrier
group by 1
```
<Row>
  <BigValue data=carrier_summary value=flights fmt=num0 title="Flights analyzed" emptySet=pass />
  <BigValue data=carrier_summary value=avg_departure_delay_minutes fmt=num1 title="Avg departure delay (min)" emptySet=pass />
  <BigValue data=carrier_summary value=avg_arrival_delay_minutes fmt=num1 title="Avg arrival delay (min)" emptySet=pass />
</Row>
<Row>
  <BigValue data=carrier_summary value=departing_over_15_rate fmt=pct1 title="Departures 15+ min late" emptySet=pass />
  <BigValue data=carrier_summary value=arriving_over_15_rate fmt=pct1 title="Arrivals 15+ min late" emptySet=pass />
  <BigValue data=carrier_summary value=cancellation_rate fmt=pct1 title="Cancellation rate" downIsGood=true emptySet=pass />
  <BigValue data=carrier_summary value=diversion_rate fmt=pct1 title="Diversion rate" downIsGood=true emptySet=pass />
</Row>

## Delay Trend

These trendlines track the selected carrier's monthly performance. Use them to spot seasonal spikes or structural improvements.

```sql carrier_monthly_delay
from flights select
  date_trunc('month', dep_time) as month,
  avg_departure_delay as avg_departure_delay_minutes,
  avg_arrival_delay as avg_arrival_delay_minutes
where carrier = $carrier
group by 1
order by 1
```

```sql carrier_severe_delay_trend
from flights select
  date_trunc('month', dep_time) as month,
  avg(case when dep_delay > 15 then 1 else 0 end) as departing_over_15_rate,
  avg(case when arr_delay > 15 then 1 else 0 end) as arriving_over_15_rate
where carrier = $carrier
group by 1
order by 1
```

<Row>
  <LineChart
    data=carrier_monthly_delay
    x=month
    xType=time
    y=avg_departure_delay_minutes
    y2=avg_arrival_delay_minutes
    yFmt=num1
    y2Fmt=num1
    y2SeriesType=line
    legend=true
    xFmt=yyyy-mm
    showAllXAxisLabels=false
    yAxisTitle="Minutes"
    y2AxisTitle="Minutes"
    title="Average delay by month"
    subtitle="Departures and arrivals usually shift together"
  />
  <LineChart
    data=carrier_severe_delay_trend
    x=month
    xType=time
    y=departing_over_15_rate
    y2=arriving_over_15_rate
    yFmt=pct0
    y2Fmt=pct0
    y2SeriesType=line
    legend=true
    xFmt=yyyy-mm
    showAllXAxisLabels=false
    y2Max=0.5
    yMax=0.5
    yAxisTitle="Percent"
    y2AxisTitle="Percent"
    title="Share of flights 15+ minutes late"
    subtitle="Quickly assess whether the carrier holds the DOT on-time threshold"
  />
</Row>

## Delay Distribution

Break flights into buckets to see how often departures fall into each delay band.

```sql carrier_delay_buckets
from flights select
  case
    when dep_delay <= 0 then 'On time or early'
    when dep_delay <= 15 then '0-15 min late'
    when dep_delay <= 60 then '15-60 min late'
    else 'Over 60 min late'
  end as delay_bucket,
  count() as flights
where carrier = $carrier
group by 1
order by flights desc
```

<Row>
  <PieChart
    data=carrier_delay_buckets
    category=delay_bucket
    value=flights
    labels=true
    labelContent=name-percent
    title="Departure delay mix"
    subtitle="Share of flights by delay bucket"
  />
  <Table data=carrier_delay_buckets title="Delay bucket detail" rows=4>
    <Column id=delay_bucket title="Bucket" />
    <Column id=flights title="Flights" fmt=num0 />
  </Table>
</Row>

## Hubs and Routes

Identify where the carrier burns the most minutes of delay.

```sql carrier_origin_delay
from flights select
  origin,
  origin_airport.full_name as origin_airport_name,
  avg_departure_delay as avg_departure_delay_minutes,
  avg_arrival_delay as avg_arrival_delay_minutes,
  avg(case when dep_delay > 30 then 1 else 0 end) as share_over_30_minutes,
  count() as flights
where carrier = $carrier
group by 1, 2
having flights >= 150
order by avg_departure_delay_minutes desc
limit 15
```

```sql carrier_route_delay
from flights select
  origin,
  destination,
  destination_airport.full_name as destination_airport_name,
  avg_departure_delay as avg_departure_delay_minutes,
  avg_arrival_delay as avg_arrival_delay_minutes,
  count() as flights
where carrier = $carrier
group by 1, 2, 3
having flights >= 100
order by avg_arrival_delay_minutes desc
limit 15
```

<Row>
  <BarChart
    data=carrier_origin_delay
    x=origin
    y=avg_departure_delay_minutes
    swapXY=true
    labels=true
    labelFmt=num1
    title="Most delayed origin airports"
    subtitle="Filtered to airports with 150+ flights for the carrier"
  />
  <Table
    data=carrier_origin_delay
    title="Origin performance"
    subtitle="Departure and arrival delay comparison"
    rows=15
    rowNumbers=true
    rowShading=true
  >
    <Column id=origin title="Origin" />
    <Column id=origin_airport_name title="Airport" />
    <Column id=flights title="Flights" fmt=num0 />
    <Column id=avg_departure_delay_minutes title="Avg dep delay" fmt=num1 />
    <Column id=avg_arrival_delay_minutes title="Avg arr delay" fmt=num1 />
    <Column id=share_over_30_minutes title="\u226530 min share" fmt=pct1 />
  </Table>
</Row>

<Table
  data=carrier_route_delay
  title="Routes with the heaviest arrival delays"
  subtitle="Filtered to routes with at least 100 flights"
  rows=15
  rowNumbers=true
  rowShading=true
>
  <Column id=origin title="Origin" />
  <Column id=destination title="Destination" />
  <Column id=destination_airport_name title="Destination airport" />
  <Column id=flights title="Flights" fmt=num0 />
  <Column id=avg_departure_delay_minutes title="Avg dep delay" fmt=num1 />
  <Column id=avg_arrival_delay_minutes title="Avg arr delay" fmt=num1 />
</Table>

## When to Expect Trouble

Late departures stack up as the day progresses, especially when the carrier is already delay-prone.

```sql carrier_delay_by_hour
from flights select
  extract(hour from dep_time) as hour_of_day,
  avg_departure_delay as avg_departure_delay_minutes,
  avg(case when dep_delay > 15 then 1 else 0 end) as severe_delay_rate,
  count() as flights
where carrier = $carrier
group by 1
order by 1
```

  <LineChart
    data=carrier_delay_by_hour
    x=hour_of_day
    y=avg_departure_delay_minutes
    y2=severe_delay_rate
  yFmt=num1
  y2Fmt=pct0
  y2Max=0.5
  y2SeriesType=area
  legend=true
  yAxisTitle="Minutes"
  y2AxisTitle="Percent"
  title="Hourly departure delays"
    subtitle="Average minutes delayed (line) and share 15+ minutes late (area)"
    xAxisTitle="Hour"
/>
