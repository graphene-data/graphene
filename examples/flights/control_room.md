---
title: Flight Control Room
layout: dashboard
---

<style>
  @import url("https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@600;700&display=swap");

  .control-room {
    --display-font: "Roboto Condensed", var(--font-ui);
    --ink: #172026;
    --muted: #5e6a70;
    --line: #d5dde0;
    --panel: #ffffff;
    --runway: #263238;
    --signal: #2f7d68;
    --amber: #c99335;
    --alert: #b75f4f;
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .tower-hero {
    min-height: 300px;
    border: 1px solid var(--line);
    background:
      linear-gradient(90deg, rgba(255,255,255,0.94), rgba(255,255,255,0.64)),
      repeating-linear-gradient(0deg, transparent 0 22px, rgba(23,32,38,0.05) 22px 23px),
      linear-gradient(135deg, #dfe9eb, #f8faf8 55%, #e4ded2);
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(320px, 0.75fr);
    gap: 28px;
    align-items: stretch;
    overflow: hidden;
    position: relative;
  }

  .tower-hero::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 34px;
    height: 56px;
    background:
      repeating-linear-gradient(90deg, transparent 0 42px, rgba(255,255,255,0.92) 42px 72px, transparent 72px 118px),
      linear-gradient(var(--runway), var(--runway));
    opacity: 0.92;
  }

  .tower-copy {
    padding: 30px 34px 98px;
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    color: var(--signal);
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    margin-bottom: 10px;
    text-transform: uppercase;
  }

  .tower-copy h2 {
    color: var(--ink);
    font-family: var(--display-font);
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.02;
    margin: 0 0 14px;
    max-width: 700px;
  }

  .tower-copy p {
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 16px;
    line-height: 1.45;
    margin: 0;
    max-width: 620px;
  }

  .radar-panel {
    align-self: stretch;
    border-left: 1px solid rgba(23,32,38,0.12);
    display: grid;
    place-items: center;
    padding: 24px 28px 98px;
    position: relative;
    z-index: 1;
  }

  .radar {
    aspect-ratio: 1;
    border: 1px solid rgba(23,32,38,0.2);
    border-radius: 999px;
    width: min(100%, 270px);
    background:
      radial-gradient(circle, transparent 0 16%, rgba(47,125,104,0.16) 16.3% 16.8%, transparent 17% 32%, rgba(47,125,104,0.14) 32.3% 32.8%, transparent 33% 49%, rgba(47,125,104,0.12) 49.3% 49.8%, transparent 50%),
      conic-gradient(from 34deg, rgba(47,125,104,0.42), rgba(47,125,104,0) 74deg),
      linear-gradient(90deg, transparent 49.7%, rgba(23,32,38,0.18) 49.9% 50.1%, transparent 50.3%),
      linear-gradient(0deg, transparent 49.7%, rgba(23,32,38,0.18) 49.9% 50.1%, transparent 50.3%);
    position: relative;
  }

  .radar::before,
  .radar::after {
    content: "";
    border-radius: 999px;
    height: 10px;
    position: absolute;
    width: 10px;
  }

  .radar::before {
    background: var(--amber);
    left: 30%;
    top: 22%;
  }

  .radar::after {
    background: var(--alert);
    bottom: 26%;
    right: 28%;
  }

  .ops-strip {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .ops-card {
    background: var(--panel);
    border: 1px solid var(--line);
    padding: 16px 18px;
  }

  .ops-label {
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .ops-value {
    color: var(--ink);
    font-family: var(--display-font);
    font-size: 30px;
    font-weight: 700;
    line-height: 1;
  }

  .ops-note {
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 12px;
    margin-top: 8px;
  }

  .flight-grid {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(0, 1fr) 360px;
  }

  .chart-deck,
  .route-board,
  .bank-board {
    background: var(--panel);
    border: 1px solid var(--line);
    min-width: 0;
  }

  .panel-heading {
    align-items: center;
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    padding: 14px 16px;
  }

  .panel-heading h3 {
    color: var(--ink);
    font-family: var(--font-ui);
    font-size: 14px;
    letter-spacing: 0.06em;
    line-height: 1;
    margin: 0;
    text-transform: uppercase;
  }

  .panel-heading span {
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 12px;
  }

  .chart-pad {
    padding: 12px 14px 4px;
  }

  .route-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .route-chip {
    border: 1px solid var(--line);
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr auto;
    padding: 12px;
  }

  .route-code {
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .route-meta {
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 12px;
  }

  .route-rate {
    align-self: center;
    color: var(--signal);
    font-family: var(--display-font);
    font-size: 20px;
    font-weight: 700;
  }

  .bank-board {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .bank-card {
    border-right: 1px solid var(--line);
    padding: 16px;
  }

  .bank-card:last-child {
    border-right: 0;
  }

  .bank-name {
    color: var(--ink);
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bank-delay {
    color: var(--amber);
    font-family: var(--display-font);
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    margin: 12px 0 6px;
  }

  @media (max-width: 900px) {
    .tower-hero,
    .flight-grid,
    .bank-board {
      grid-template-columns: 1fr;
    }

    .radar-panel {
      border-left: 0;
      border-top: 1px solid rgba(23,32,38,0.12);
      padding-top: 18px;
    }

    .ops-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .bank-card {
      border-bottom: 1px solid var(--line);
      border-right: 0;
    }
  }
</style>

```gsql ops_kpis
from flights
select
  count() as flights,
  on_time_departure_rate,
  cancellation_rate,
  round(avg(taxi_out), 1) as avg_taxi_out
```

```gsql peak_routes
from flights
where cancelled = 'N'
select
  origin || ' -> ' || destination as route,
  count() as flights,
  on_time_arrival_rate
order by flights desc
limit 6
```

```gsql hourly_status
from flights
where extract(hour from dep_time)::integer between 5 and 23
select
  extract(hour from dep_time)::integer as hour,
  status,
  count() as flights
order by hour, status
```

```gsql tower_load
from flights
where cancelled = 'N'
select
  origin as airport,
  origin_airport.city as city,
  count() as flights,
  avg(dep_delay) as avg_delay,
  on_time_departure_rate
having count() > 3000
order by flights desc
limit 12
```

```gsql departure_banks
from flights
where cancelled = 'N'
select
  case
    when extract(hour from dep_time)::integer < 10 then 'Morning'
    when extract(hour from dep_time)::integer < 14 then 'Midday'
    when extract(hour from dep_time)::integer < 18 then 'Afternoon'
    else 'Evening'
  end as bank,
  case
    when extract(hour from dep_time)::integer < 10 then 1
    when extract(hour from dep_time)::integer < 14 then 2
    when extract(hour from dep_time)::integer < 18 then 3
    else 4
  end as sort_key,
  count() as flights,
  round(avg(dep_delay), 1) as avg_delay,
  on_time_departure_rate
order by sort_key
```

<div class="control-room">
  <section class="tower-hero">
    <div class="tower-copy">
      <div class="eyebrow">FAA operations log • 2000-2005</div>
      <h2>Custom markup turns a dashboard into a control room.</h2>
      <p>This page is regular Graphene markdown, but the layout is hand-built with HTML and CSS. Components are embedded inside custom panels, metric strips, and route boards without leaving the dashboard file.</p>
    </div>
    <div class="radar-panel">
      <div class="radar"></div>
    </div>
  </section>

  <section class="ops-strip">
    <div class="ops-card">
      <div class="ops-label">Flights tracked</div>
      <div class="ops-value"><Value data=ops_kpis column=flights /></div>
      <div class="ops-note">All scheduled rows in the local FAA sample</div>
    </div>
    <div class="ops-card">
      <div class="ops-label">On-time departures</div>
      <div class="ops-value"><Value data=ops_kpis column=on_time_departure_rate /></div>
      <div class="ops-note">Actual departure at or before schedule</div>
    </div>
    <div class="ops-card">
      <div class="ops-label">Cancellation rate</div>
      <div class="ops-value"><Value data=ops_kpis column=cancellation_rate /></div>
      <div class="ops-note">Flights cancelled before departure</div>
    </div>
    <div class="ops-card">
      <div class="ops-label">Avg taxi-out</div>
      <div class="ops-value"><Value data=ops_kpis column=avg_taxi_out /></div>
      <div class="ops-note">Minutes from gate pushback to takeoff</div>
    </div>
  </section>

  <section class="flight-grid">
    <div class="chart-deck">
      <div class="panel-heading">
        <h3>Hourly departure board</h3>
        <span>Status mix by scheduled hour</span>
      </div>
      <div class="chart-pad">
        <BarChart data=hourly_status x=hour y=flights splitBy=status arrange=stack height=360px />
      </div>
    </div>

    <aside class="route-board">
      <div class="panel-heading">
        <h3>Busiest lanes</h3>
        <span>Top nonstop pairs</span>
      </div>
      <div class="route-list">
        <div class="route-chip">
          <div>
            <div class="route-code"><Value data=peak_routes column=route row=0 /></div>
            <div class="route-meta"><Value data=peak_routes column=flights row=0 /> flights</div>
          </div>
          <div class="route-rate"><Value data=peak_routes column=on_time_arrival_rate row=0 /></div>
        </div>
        <div class="route-chip">
          <div>
            <div class="route-code"><Value data=peak_routes column=route row=1 /></div>
            <div class="route-meta"><Value data=peak_routes column=flights row=1 /> flights</div>
          </div>
          <div class="route-rate"><Value data=peak_routes column=on_time_arrival_rate row=1 /></div>
        </div>
        <div class="route-chip">
          <div>
            <div class="route-code"><Value data=peak_routes column=route row=2 /></div>
            <div class="route-meta"><Value data=peak_routes column=flights row=2 /> flights</div>
          </div>
          <div class="route-rate"><Value data=peak_routes column=on_time_arrival_rate row=2 /></div>
        </div>
        <div class="route-chip">
          <div>
            <div class="route-code"><Value data=peak_routes column=route row=3 /></div>
            <div class="route-meta"><Value data=peak_routes column=flights row=3 /> flights</div>
          </div>
          <div class="route-rate"><Value data=peak_routes column=on_time_arrival_rate row=3 /></div>
        </div>
      </div>
    </aside>

  </section>

  <section class="bank-board">
    <div class="bank-card">
      <div class="bank-name"><Value data=departure_banks column=bank row=0 /></div>
      <div class="bank-delay"><Value data=departure_banks column=avg_delay row=0 /> min</div>
      <div class="route-meta"><Value data=departure_banks column=on_time_departure_rate row=0 /> on-time departures</div>
    </div>
    <div class="bank-card">
      <div class="bank-name"><Value data=departure_banks column=bank row=1 /></div>
      <div class="bank-delay"><Value data=departure_banks column=avg_delay row=1 /> min</div>
      <div class="route-meta"><Value data=departure_banks column=on_time_departure_rate row=1 /> on-time departures</div>
    </div>
    <div class="bank-card">
      <div class="bank-name"><Value data=departure_banks column=bank row=2 /></div>
      <div class="bank-delay"><Value data=departure_banks column=avg_delay row=2 /> min</div>
      <div class="route-meta"><Value data=departure_banks column=on_time_departure_rate row=2 /> on-time departures</div>
    </div>
    <div class="bank-card">
      <div class="bank-name"><Value data=departure_banks column=bank row=3 /></div>
      <div class="bank-delay"><Value data=departure_banks column=avg_delay row=3 /> min</div>
      <div class="route-meta"><Value data=departure_banks column=on_time_departure_rate row=3 /> on-time departures</div>
    </div>
  </section>

  <section class="chart-deck">
    <div class="panel-heading">
      <h3>Tower load by airport</h3>
      <span>Volume, average delay, and departure reliability</span>
    </div>
    <div class="chart-pad">
      <ECharts data=tower_load height=420px>
        title: {show: false},
        tooltip: {trigger: 'item'},
        grid: {left: 82, right: 42, bottom: 58, top: 20},
        xAxis: {
          type: 'value',
          name: 'Flights',
          nameLocation: 'middle',
          nameGap: 34,
          axisLine: {show: false},
          axisTick: {show: false},
          splitLine: {lineStyle: {color: '#edf1f2'}},
        },
        yAxis: {
          type: 'category',
          inverse: true,
          axisLine: {show: false},
          axisTick: {show: false},
          encode: {y: 'airport'},
        },
        series: [{
          type: 'bar',
          encode: {x: 'flights', y: 'airport', tooltip: ['city', 'avg_delay', 'on_time_departure_rate']},
          label: {show: true, position: 'right', formatter: '{@city}', color: '#5e6a70'},
          itemStyle: {color: '#2f7d68', borderRadius: [0, 3, 3, 0]},
        }]
      </ECharts>
    </div>
  </section>
</div>
