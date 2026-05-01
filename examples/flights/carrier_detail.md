---
title: Carrier Detail
layout: dashboard
---

<Dropdown name=carrier data=carriers value=code label=nickname title="Carrier" defaultValue="WN" />

```gsql carrier_info
from carriers where code = $carrier select nickname, code
```

```gsql carrier_flights
from flights where carriers.code = $carrier and cancelled = 'N'
```

```gsql carrier_ranks
from (from flights select carriers.code as code, count() as total_flights, on_time_arrival_rate)
select code,
  rank() over (order by total_flights desc) as flights_rank,
  rank() over (order by on_time_arrival_rate desc) as ontime_rank
```

```gsql kpis
from flights where carriers.code = $carrier
select
  extract(year from min(dep_time))::text as operating_since,
  count() as total_flights,
  count(distinct destination) as destinations
```

```gsql rank_kpis
from carrier_ranks where code = $carrier
select
  flights_rank::text || case
    when flights_rank % 100 between 11 and 13 then 'th'
    when flights_rank % 10 = 1 then 'st'
    when flights_rank % 10 = 2 then 'nd'
    when flights_rank % 10 = 3 then 'rd'
    else 'th'
  end as flights_rank,
  ontime_rank::text || case
    when ontime_rank % 100 between 11 and 13 then 'th'
    when ontime_rank % 10 = 1 then 'st'
    when ontime_rank % 10 = 2 then 'nd'
    when ontime_rank % 10 = 3 then 'rd'
    else 'th'
  end as ontime_rank
```

**<Value data=carrier_info column=nickname /> (<Value data=carrier_info column=code />)**
has been operating since <Value data=kpis column=operating_since />,
with <Value data=kpis column=total_flights fmt=num0 />
flights to <Value data=kpis column=destinations /> destinations.

<Row>
  <BigValue data=rank_kpis value=flights_rank title="Rank (by Flights)" />
  <BigValue data=rank_kpis value=ontime_rank title="Rank (by On-Time Rate)" />
</Row>

```gsql carrier_trend
from flights
where cancelled = 'N' and extract(year from dep_time)::integer = 2005
select
  date_trunc('month', dep_time) as month,
  carriers.nickname as carrier,
  carriers.code as code,
  case when carriers.code != $carrier then count() end as other_flights,
  case when carriers.code != $carrier then on_time_arrival_rate end as other_ontime_rate,
  case when carriers.code = $carrier then count() end as selected_flights,
  case when carriers.code = $carrier then on_time_arrival_rate end as selected_ontime_rate,
  case when carriers.code = $carrier then 1 else 0 end as is_selected
order by is_selected, month
```

<Row>
  <ECharts data=carrier_trend>
    title: {text: 'Monthly Flights by Carrier (2005)'},
    legend: {show: false},
    tooltip: {trigger: 'item'},
    grid: {right: 25},
    xAxis: {type: 'time'},
    yAxis: {type: 'value'},
    series: [
      {
        type: 'line',
        smooth: false,
        showSymbol: false,
        encode: {x: 'month', y: 'other_flights', splitBy: 'carrier', label: 'code'},
        lineStyle: {width: 1, color: '#d1d5db'},
        itemStyle: {color: '#d1d5db'},
      },
      {
        type: 'line',
        smooth: false,
        showSymbol: true,
        encode: {x: 'month', y: 'selected_flights'},
        connectNulls: true,
        lineStyle: {width: 2.5, color: '#3D6B7E'},
        itemStyle: {color: '#3D6B7E'},
        endLabel: {show: true, formatter: '{@code}', color: '#3D6B7E'},
      }
    ]
  </ECharts>
  <ECharts data=carrier_trend>
    title: {text: 'On-Time Arrival Rate by Carrier (2005)'},
    legend: {show: false},
    tooltip: {trigger: 'item'},
    grid: {right: 25},
    xAxis: {type: 'time'},
    yAxis: {type: 'value'},
    series: [
      {
        type: 'line',
        smooth: false,
        showSymbol: false,
        encode: {x: 'month', y: 'other_ontime_rate', splitBy: 'carrier', label: 'code'},
        lineStyle: {width: 1, color: '#d1d5db'},
        itemStyle: {color: '#d1d5db'},
      },
      {
        type: 'line',
        smooth: false,
        showSymbol: true,
        encode: {x: 'month', y: 'selected_ontime_rate'},
        connectNulls: true,
        lineStyle: {width: 2.5, color: '#3D6B7E'},
        itemStyle: {color: '#3D6B7E'},
        endLabel: {show: true, formatter: '{@code}', color: '#3D6B7E'},
      }
    ]
  </ECharts>
</Row>

```gsql delay_dist
from carrier_flights select
  case
    when dep_delay < -15 then '< -15 min'
    when dep_delay < 0 then '-15 to 0 min'
    when dep_delay < 15 then '0 to 15 min'
    when dep_delay < 30 then '15 to 30 min'
    when dep_delay < 60 then '30 to 60 min'
    when dep_delay < 120 then '60 to 120 min'
    else '120+ min'
  end as bucket,
  count() as flights,
  min(dep_delay) as sort_key
order by sort_key
```

<BarChart data=delay_dist x=bucket y=flights sort="sort_key asc" title="Departure Delay Distribution" />

```gsql fleet_aircraft
from aircraft
where flights.carriers.code = $carrier and flights.cancelled = 'N'
select
  tail_num,
  aircraft_models.manufacturer as manufacturer,
  aircraft_models.model as model,
  year_built::text as year_built,
  count(flights.id2) as flights_flown,
  sum(flights.miles_flown) as miles_flown
order by flights_flown desc
limit 100
```

<Table data=fleet_aircraft title="Fleet" rows=100 emptySet=warn>
  <Column id=tail_num title="Tail #" />
  <Column id=manufacturer />
  <Column id=model />
  <Column id=year_built title="Year Built" />
  <Column id=flights_flown title="Flights" fmt=num0 />
  <Column id=miles_flown />
</Table>
