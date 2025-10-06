# Flight Operations Overview

Domestic schedules from 2000–2005 give us a broad look at how carriers perform across the network. These views highlight volume, delay trends, and where operations tend to struggle.

```sql flight_summary
from flights select
  count(distinct carriers.code) as carrier_count,
  count() as total_flights,
  avg(case when dep_delay <= 0 then 1 else 0 end) as on_time_departure_rate,
  avg(case when arr_delay <= 0 then 1 else 0 end) as on_time_arrival_rate,
  avg(dep_delay) as avg_departure_delay_minutes,
  avg(arr_delay) as avg_arrival_delay_minutes,
  avg(case when is_cancelled then 1 else 0 end) as cancellation_rate,
  avg(case when is_diverted then 1 else 0 end) as diversion_rate
```

<Row>
  <BigValue data="flight_summary" value="total_flights" fmt="num0" title="Flights analyzed" />
  <BigValue data="flight_summary" value="carrier_count" fmt="num0" title="Number of carriers" />
  <BigValue data="flight_summary" value="cancellation_rate" fmt="pct1" title="Cancellation rate" downIsGood="true" />
  <BigValue data="flight_summary" value="diversion_rate" fmt="pct1" title="Diversion rate" downIsGood="true" />
</Row>
<Row>
  <BigValue data="flight_summary" value="on_time_departure_rate" fmt="pct1" title="Departures on time" />
  <BigValue data="flight_summary" value="on_time_arrival_rate" fmt="pct1" title="Arrivals on time" />
  <BigValue data="flight_summary" value="avg_departure_delay_minutes" fmt="num1" title="Avg departure delay (min)" />
  <BigValue data="flight_summary" value="avg_arrival_delay_minutes" fmt="num1" title="Avg arrival delay (min)" />
</Row>

## Delay Patterns Over Time

Departure and arrival delays move together, with noticeable spikes around mid-summer and winter holidays. The second chart tracks the share of flights that miss the 15-minute DOT on-time window.

```sql monthly_delay_trend
from flights select
  date_trunc('month', dep_time) as month,
  avg(dep_delay) as avg_departure_delay_minutes,
  avg(arr_delay) as avg_arrival_delay_minutes
group by 1
order by 1
```

```sql severe_delay_trend
from flights select
  date_trunc('month', dep_time) as month,
  avg(case when dep_delay > 15 then 1 else 0 end) as departing_over_15_rate,
  avg(case when arr_delay > 15 then 1 else 0 end) as arriving_over_15_rate
group by 1
order by 1
```

<Row>
  <LineChart
    data="monthly_delay_trend"
    x="month"
    xType="time"
    y="avg_departure_delay_minutes"
    y2="avg_arrival_delay_minutes"
    yFmt="num1"
    y2Fmt="num1"
    y2SeriesType="line"
    legend="true"
    xFmt="yyyy-mm"
    showAllXAxisLabels="false"
    yAxisTitle="Minutes"
    y2AxisTitle="Minutes"
    title="Average delay by month"
    subtitle="Both departure and arrival delays spike during peak travel periods"
  />
  <LineChart
    data="severe_delay_trend"
    x="month"
    xType="time"
    y="departing_over_15_rate"
    y2="arriving_over_15_rate"
    yFmt="pct0"
    y2Fmt="pct0"
    y2SeriesType="line"
    legend="true"
    xFmt="yyyy-mm"
    showAllXAxisLabels="false"
    y2Max=0.35
    yMax=0.35
    yAxisTitle="Percent"
    y2AxisTitle="Percent"
    title="Share of flights delayed 15+ minutes"
    subtitle="Arrival delays breach the 15-minute mark slightly more often than departures"
  />
</Row>

## Airports Driving Delays

Congested hubs dominate the long tail of late departures. Filtering to airports with at least 3k flights surfaces the busiest and most delay-prone origins.

```sql origin_delay
from flights select
  origin,
  origin_airport.full_name as origin_airport_name,
  avg(dep_delay) as avg_departure_delay_minutes,
  avg(case when dep_delay > 30 then 1 else 0 end) as share_over_30_minutes,
  count() as flights
group by 1, 2
having flights >= 3000
order by avg_departure_delay_minutes desc
limit 15
```

<Row>
  <BarChart
    data="origin_delay"
    x="origin"
    y="avg_departure_delay_minutes"
    swapXY="true"
    labels="true"
    labelFmt="num1"
    title="Average departure delay by origin"
    subtitle="Top 15 busy airports ranked by minutes of delay"
  />
  <Table
    data="origin_delay"
    title="Delay profile by origin"
    subtitle="Busy airports only (>=3k flights in sample)"
    sort="avg_departure_delay_minutes desc"
    rows="15"
    rowNumbers="true"
    headerColor="base-200"
  >
    <Column id="origin" title="Origin" />
    <Column id="origin_airport_name" title="Airport" />
    <Column id="flights" title="Flights" fmt="num0" />
    <Column id="avg_departure_delay_minutes" title="Avg dep delay" fmt="num1" />
    <Column id="share_over_30_minutes" title=">=30 min share" fmt="pct1" />
  </Table>
</Row>

## When Delays Happen

Evening pushes introduce the heaviest departure delays. Severe delays (15+ minutes) nearly double between the morning lull and late night departures.

```sql delay_by_hour
from flights select
  extract(hour from dep_time) as hour_of_day,
  avg(dep_delay) as avg_departure_delay_minutes,
  avg(case when dep_delay > 15 then 1 else 0 end) as severe_delay_rate,
  count() as flights
group by 1
order by 1
```

<LineChart
  data="delay_by_hour"
  x="hour_of_day"
  y="avg_departure_delay_minutes"
  y2="severe_delay_rate"
  yFmt="num1"
  y2Fmt="pct0"
  y2SeriesType="area"
  legend="true"
  yAxisTitle="Minutes"
  y2AxisTitle="Percent"
  title="Departure delays by hour of day"
  subtitle="Average minutes delayed (line) and share 15+ minutes late (area)"
  xAxisTitle="Hour"
/>

## Carrier Performance Snapshot

Southwest, US Airways, and American operate the largest share of flights in the sample. ExpressJet (EV) and Alaska (AS) manage fewer flights but see notably higher delay rates.

```sql carrier_performance
from flights select
  carrier,
  carriers.name as carrier_name,
  count() as flights,
  avg(dep_delay) as avg_departure_delay_minutes,
  avg(arr_delay) as avg_arrival_delay_minutes,
  avg(case when dep_delay > 15 then 1 else 0 end) as departing_over_15_rate,
  avg(case when arr_delay > 15 then 1 else 0 end) as arriving_over_15_rate
group by 1, 2
having flights >= 2000
order by flights desc
```

<Row>
  <BarChart
    data="carrier_performance"
    x="carrier_name"
    y="flights"
    swapXY="true"
    labels="true"
    labelFmt="num0"
    title="Flights by carrier"
    subtitle="Carriers with 2k+ flights in the sample"
  />
  <BarChart
    data="carrier_performance"
    x="carrier_name"
    y="departing_over_15_rate"
    swapXY="true"
    labels="true"
    labelFmt="pct1"
    yFmt="pct0"
    title="Share of departures 15+ min late"
    subtitle="ExpressJet and Alaska stand out for long delays"
  />
</Row>

<Table
  data="carrier_performance"
  title="Carrier delay profile"
  subtitle="Ordered by volume"
  sort="flights desc"
  rows="12"
  rowNumbers="true"
  rowShading="true"
  headerColor="base-200"
>
  <Column id="carrier" title="Code" />
  <Column id="carrier_name" title="Carrier" />
  <Column id="flights" title="Flights" fmt="num0" />
  <Column id="avg_departure_delay_minutes" title="Avg dep delay" fmt="num1" />
  <Column id="avg_arrival_delay_minutes" title="Avg arr delay" fmt="num1" />
  <Column id="departing_over_15_rate" title="Dep 15+ min" fmt="pct1" />
  <Column id="arriving_over_15_rate" title="Arr 15+ min" fmt="pct1" />
</Table>
