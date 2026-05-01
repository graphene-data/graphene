---
title: Flight Operations Overview
layout: dashboard
---

```gsql flown
-- most of our charts only show stats from flights that actually flew
from flights where not is_cancelled
```

<Row>
  <BigValue data=flights value="count()" title="Total Flights" />
  <BigValue data=flights value=on_time_arrival_rate title="On-Time Arrival" />
  <BigValue data=flights value=cancellation_rate title="Cancellation Rate" />
  <BigValue data=flights value="avg(dep_delay)" title="Avg Departure Delay" />
</Row>

```gsql performance_by_year
from flights select date_trunc('year', dep_time), status, count() as flight_count order by year, status
```

<Row>
  <AreaChart title="Monthly Flight Volume" data=flown x="date_trunc('month', dep_time)"  y="count()" />
  <BarChart title="Flight Status by Year" data=performance_by_year x=year y=flight_count splitBy=status />
</Row>

```gsql delay_heatmap
from flights
where cancelled = 'N' and extract(hour from dep_time)::integer between 5 and 23
select
  case extract(hour from dep_time)::integer
    when 5 then '5am' when 6 then '6am' when 7 then '7am' when 8 then '8am'
    when 9 then '9am' when 10 then '10am' when 11 then '11am' when 12 then '12pm'
    when 13 then '1pm' when 14 then '2pm' when 15 then '3pm' when 16 then '4pm'
    when 17 then '5pm' when 18 then '6pm' when 19 then '7pm' when 20 then '8pm'
    when 21 then '9pm' when 22 then '10pm' when 23 then '11pm'
  end as hour_label,
  case extract(dow from dep_time)::integer
    when 0 then 'Sun' when 1 then 'Mon' when 2 then 'Tue' when 3 then 'Wed'
    when 4 then 'Thu' when 5 then 'Fri' when 6 then 'Sat'
  end as day_label,
  round(avg(dep_delay), 1) as avg_delay
```

```sql airport_scatter
from flown select origin as code,
  round(avg(dep_delay), 1) as avg_dep_delay,
  round(avg(arr_delay), 1) as avg_arr_delay,
  round(count() / count(distinct extract(year from dep_time)::integer), 0) as avg_annual_flights
having count() > 100
```

<Row>
  <!-- Graphene will have a built-in <Heatmap> component, but this serves as a great example of just
       how much power and flexibility an agent has with gsql + ECharts.
  -->
  <ECharts data=delay_heatmap height=520px>
    title: {text: 'Avg Departure Delay by Hour & Day of Week (min)'},
    tooltip: {trigger: 'item'},
    visualMap: {
      min: -7.5, max: 30,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      inRange: {color: ['#5B8F9E', '#e4eff3', '#D4A94C', '#C87F5A', '#C4868E', '#B87470']},
    },
    grid: {top: 20},
    xAxis: {
      type: 'category',
      position: 'top',
      data: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: ['5am','6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm'],
    },
    series: [{
      type: 'heatmap',
      encode: {x: 'day_label', y: 'hour_label', value: 'avg_delay'},
      label: {show: false},
    }],
  </ECharts>

  <ECharts data=airport_scatter height=528px>
    title: {text: 'Departure vs Arrival Delay by Airport'},
    tooltip: {trigger: 'item'},
    grid: {top: 20},
    visualMap: {
      dimension: 'avg_annual_flights',
      type: 'continuous',
      min: 0, max: 3000,
      inRange: {symbolSize: [4, 32]},
      show: false,
    },
    xAxis: {
      type: 'value',
      name: 'Avg Departure Delay (min)',
      nameLocation: 'middle',
      nameGap: 22,
      axisLine: {show: false},
      axisTick: {show: false},
    },
    yAxis: {
      type: 'value',
      name: 'Avg Arrival Delay (min)',
      nameLocation: 'middle',
      nameGap: 20,
      axisLine: {show: false},
      axisTick: {show: false},
    },
    series: [{
      type: 'scatter',
      encode: {x: 'avg_dep_delay', y: 'avg_arr_delay', itemName: 'code', tooltip: 'avg_annual_flights'},
      itemStyle: {opacity: 0.8},
      tooltip: {formatter: '{b}'},
    }]
  </ECharts>
</Row>

```gsql top_carriers
from flights
select
  carriers.nickname as carrier,
  count() as flights,
  on_time_arrival_rate,
  cancellation_rate,
  avg(dep_delay) as avg_dep_delay,
  count(distinct destination) as destinations,
  round(avg(aircraft_age), 1) as avg_aircraft_age,
  round(avg(distance), 0) as avg_distance,
  '/carrier_detail?carrier=' || carriers.code as link
order by flights desc
```

<Table data=top_carriers title="Top Carriers" link=link showLinkCol=false rows=100>
  <Column id=carrier />
  <Column id=flights fmt=num0 />
  <Column id=on_time_arrival_rate title="On-Time Arr %" fmt=pct1 contentType=colorscale colorScale=positive />
  <Column id=cancellation_rate title="Cancel %" fmt=pct2 contentType=colorscale colorScale=negative />
  <Column id=avg_dep_delay title="Avg Delay (min)" fmt="0.0" />
  <Column id=destinations title="Destinations" fmt=num0 />
  <Column id=avg_aircraft_age title="Avg Aircraft Age (y)" fmt="0.0" />
  <Column id=avg_distance title="Avg Distance (mi)" fmt=num0 />
</Table>
