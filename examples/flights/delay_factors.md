---
title: What makes your flight late?
layout: notebook
---

Every frequent flyer has a pet theory. Pick the right airline. Avoid Chicago. Never fly a 20-year-old plane. These intuitions have just enough truth in them to survive, but they obscure which factors actually move the needle — and by how much.

This is an analysis of FAA data covering roughly 345,000 U.S. commercial flights from 2000 to 2005. For each candidate factor — airline, origin airport, day of the week, and time of day — I measured how much of the variance in individual departure delays each one explains (η², or eta-squared). A high η² means knowing that factor genuinely helps predict whether *your* flight will be late.

## One factor dwarfs the rest

```sql factor_importance
with
info as (
  from flights where cancelled = 'N'
  select avg(dep_delay) as grand_mean, var_pop(dep_delay) * count() as ss_total
),
hour_groups as (
  from flights where cancelled = 'N' and extract(hour from dep_time)::integer between 5 and 23
  select extract(hour from dep_time) as grp, count() as n, avg(dep_delay) as grp_mean
),
carrier_groups as (
  from flights where cancelled = 'N'
  select carriers.nickname as grp, count() as n, avg(dep_delay) as grp_mean
),
origin_groups as (
  from flights where cancelled = 'N'
  select origin as grp, count() as n, avg(dep_delay) as grp_mean
  having count() > 2000
),
dow_groups as (
  from flights where cancelled = 'N'
  select extract(dow from dep_time)::varchar as grp, count() as n, avg(dep_delay) as grp_mean
)
select 'Hour of day' as factor, sum(n * power(grp_mean - grand_mean, 2)) / max(ss_total) as eta_squared
  from hour_groups inner join info on true
union all
select 'Airline', sum(n * power(grp_mean - grand_mean, 2)) / max(ss_total)
  from carrier_groups inner join info on true
union all
select 'Origin airport', sum(n * power(grp_mean - grand_mean, 2)) / max(ss_total)
  from origin_groups inner join info on true
union all
select 'Day of week', sum(n * power(grp_mean - grand_mean, 2)) / max(ss_total)
  from dow_groups inner join info on true
order by eta_squared desc
```

<BarChart
  data=factor_importance
  x=eta_squared
  y=factor
  title="Variance in departure delay explained by each factor (η²)"
  height=240px
/>

Hour of day is not even close. It explains **5.3%** of the variance in departure delays — roughly 13 times more than airline or origin airport, and 27 times more than day of the week. That gap isn't a rounding issue; it reflects something structural about how airline networks operate.

## The compounding clock

```sql hourly_delays
from flights
where cancelled = 'N' and extract(hour from dep_time)::integer between 5 and 23
select
  extract(hour from dep_time) as hour,
  avg(dep_delay) as avg_delay
order by hour
```

<AreaChart
  data=hourly_delays
  x=hour
  y=avg_delay
  title="Avg departure delay by hour of day"
/>

This is the signature of **delay compounding**. Aircraft don't sit overnight between flights — a single plane flies four or five legs a day. A plane that arrives 20 minutes late in Denver is now 20 minutes late departing Denver, which makes it 20 minutes late landing in Chicago, which bleeds into the next departure. By the end of the day, small delays have stacked into large ones across the entire network.

Flights at 6 a.m. escape this. They're departing on a clean slate: the plane just came out of overnight maintenance, no legs flown yet today. By 10 p.m., that same aircraft may be on its fifth hop, absorbing a full day's worth of accumulated slippage.

## The airline gap is real, just smaller

```sql carrier_stats
from flights where cancelled = 'N'
select
  carriers.nickname as carrier,
  count() as flights,
  avg(dep_delay) as avg_delay,
  round(avg(dep_delay), 1)::varchar || ' min' as delay_label
order by avg_delay desc
```

<ECharts data=carrier_stats height=380px>
  {
    tooltip: {trigger: 'item'},
    grid: {left: 145, right: 60, top: 10, bottom: 20},
    xAxis: {
      type: 'value',
      name: 'Average departure delay (minutes)',
      nameLocation: 'middle',
      nameGap: 32,
      min: 0,
      max: 15,
      axisLine: {show: false},
      axisTick: {show: false},
    },
    yAxis: {
      type: 'category',
      inverse: true,
      axisLine: {show: false},
      axisTick: {show: false},
      encode: {y: 'carrier'},
    },
    series: [
      {
        type: 'pictorialBar',
        symbol: 'rect',
        symbolRepeat: false,
        symbolSize: ['100%', 2],
        symbolAnchor: 'end',
        symbolPosition: 'end',
        encode: {x: 'avg_delay', y: 'carrier'},
        itemStyle: {color: '#6b9dc9'},
      },
      {
        type: 'scatter',
        symbolSize: 12,
        encode: {x: 'avg_delay', y: 'carrier', itemName: 'delay_label'},
        itemStyle: {color: '#6b9dc9', opacity: 1},
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 11,
          color: '#555',
        },
      }
    ],
  }
</ECharts>

Alaska and Atlantic Southeast average about 12 minutes late; ATA and Continental Express average around 4. That 8-minute gap is meaningful — across a trip with a connection, it compounds — but notice the scale relative to the time-of-day chart. The worst airline is roughly as bad as flying at 3 p.m. instead of 6 a.m. The best airline can't fully compensate for a late-evening departure.

Part of the airline spread reflects *network structure* rather than operational discipline. Airlines that run point-to-point routes (ATA, Continental Express) have fewer propagation paths for delay. Hub-and-spoke carriers like United and Alaska connect more legs in sequence, so a delay in one corner of the network ripples further.

## Where you start matters — and where you land matters differently

```sql airport_both
with dep as (
  from flights where cancelled = 'N'
  select origin as code, origin_airport.city as city, avg(dep_delay) as dep_delay
  having count() > 2000
),
arr as (
  from flights where cancelled = 'N'
  select destination as code, avg(arr_delay) as arr_delay
  having count() > 2000
)
select
  d.code as d_code,
  d.city as d_city,
  d.dep_delay as d_dep_delay,
  a.arr_delay as a_arr_delay,
from dep d inner join arr a on d.code = a.code
```

<ECharts data=airport_both height=400px>
  {
    tooltip: {trigger: 'item'},
    grid: {left: 65, right: 30, top: 30, bottom: 65},
    xAxis: {
      type: 'value',
      name: 'Avg departure delay from this airport (min)',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 15,
      splitLine: {lineStyle: {color: '#f0f0f0'}},
      axisLine: {show: false},
      axisTick: {show: false},
    },
    yAxis: {
      type: 'value',
      name: 'Avg arrival delay at this airport (min)',
      nameLocation: 'middle',
      nameGap: 50,
      min: 0,
      max: 15,
      splitLine: {lineStyle: {color: '#f0f0f0'}},
      axisLine: {show: false},
      axisTick: {show: false},
    },
    series: [
      {
        type: 'line',
        data: [[0, 0], [15, 15]],
        showSymbol: false,
        lineStyle: {color: '#ccc', width: 1, type: 'dashed'},
        tooltip: {show: false},
        z: 1,
      },
      {
        type: 'scatter',
        symbolSize: 9,
        encode: {x: 'd_dep_delay', y: 'a_arr_delay', itemName: 'd_city'},
        itemStyle: {color: '#2c6fad', opacity: 0.7},
        tooltip: {formatter: '{b}'},
        z: 2,
      },
    ],
  }
</ECharts>

Each dot is one airport. The dashed diagonal is where departure delay equals arrival delay — if you're above the line, you absorb delays; if you're below it, you amplify them.

The broad cluster sits just below the diagonal: most airports pass on a little extra delay. The outliers tell a richer story.

**ORD, ATL, and PHL** cluster in the upper right — high on both axes. These airports generate departure delays *and* their inbound lanes are congested enough to add extra arrival delays on top.

**EWR sits well above the diagonal.** Newark departs with moderate delays but arrives with the highest in the dataset — 13 minutes average. Flights bound for Newark are slotted into the congested New York–area airspace, where planes stack up in holding patterns regardless of how they left. JFK and LGA show the same effect, milder.

**MDW and HOU sit well below the diagonal.** Chicago Midway and Houston Hobby are Southwest hubs. Southwest's point-to-point model means fewer aircraft arriving from distant, delay-prone legs. Planes bound for these airports tend to arrive fresher, even though the outbound queue at Midway itself is substantial.

## Putting it together

The hierarchy is clear once you see it. Time of day is structural — it's baked into the physics of how airline networks accumulate delays across a day of operations. Airline and airport effects are real and worth knowing, but they operate within a much narrower band. A 7 a.m. flight on the worst airline in this dataset still averages less delay than a 9 p.m. flight on the best.

If you want to minimize the odds of a late departure: fly early, choose a point-to-point carrier where you can, and treat Newark arrivals with appropriate suspicion regardless of your departure airport.
