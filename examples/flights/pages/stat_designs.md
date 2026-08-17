---
layout: dashboard
---

# Stat collection design directions

Design exploration: better ways to present collections of high-level stats. All values are real (flights dataset); deltas are illustrative.

## Today: rows of BigValues

<Row>
  <BigValue data=flights value="count()" title="Total Flights" />
  <BigValue data=flights value=on_time_arrival_rate title="On-Time Arrival" />
  <BigValue data=flights value=cancellation_rate title="Cancellation Rate" />
  <BigValue data=flights value="avg(dep_delay)" title="Avg Departure Delay" />
</Row>

<Row>
  <BigValue data=flights value="avg(distance)" title="Avg Distance" />
  <BigValue data=flights value="count(distinct carrier)" title="Carriers" />
  <BigValue data=flights value="count(distinct origin)" title="Airports Served" />
</Row>

## Direction A — Stat band

<div class="band">
  <div class="band-stat">
    <span class="s-label">Total flights</span>
    <span class="s-value">344,827</span>
    <span class="s-delta pos">▲ 4.1% vs 2023</span>
  </div>
  <div class="band-stat">
    <span class="s-label">On-time arrival</span>
    <span class="s-value">58.1%</span>
    <span class="s-delta neg">▼ 2.3pp vs 2023</span>
  </div>
  <div class="band-stat">
    <span class="s-label">Cancellation rate</span>
    <span class="s-value">0.66%</span>
    <span class="s-delta pos">▼ 0.1pp vs 2023</span>
  </div>
  <div class="band-stat">
    <span class="s-label">Avg departure delay</span>
    <span class="s-value">7.7 min</span>
    <span class="s-delta neg">▲ 0.8 min vs 2023</span>
  </div>
  <div class="band-stat">
    <span class="s-label">Avg distance</span>
    <span class="s-value">740 mi</span>
    <span class="s-delta mut">flat vs 2023</span>
  </div>
</div>

## Direction B — Stat cards

<div class="cards">
  <div class="card">
    <span class="s-label">Total flights</span>
    <span class="s-value">344,827</span>
    <span class="s-delta pos">▲ 4.1% vs 2023</span>
    <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="0,14.7 9,22 18,13 27,12.9 36,6.7 45,8 54,4.7 63,2 72,15.6 81,9.6 90,16.4 100,10.2" /></svg>
  </div>
  <div class="card">
    <span class="s-label">On-time arrival</span>
    <span class="s-value">58.1%</span>
    <span class="s-delta neg">▼ 2.3pp vs 2023</span>
    <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="0,14.4 9,16.3 18,15.8 27,9.0 36,9.8 45,19.7 54,18.7 63,16.9 72,2 81,11.1 90,12.7 100,22" /></svg>
  </div>
  <div class="card">
    <span class="s-label">Avg departure delay</span>
    <span class="s-value">7.7 min</span>
    <span class="s-delta neg">▲ 0.8 min vs 2023</span>
    <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="0,10.7 10,10.7 20,11.0 30,18.9 40,17.0 50,3.9 60,2 70,6.9 80,22 90,17.0 100,3.2" /></svg>
  </div>
  <div class="card">
    <span class="s-label">Cancellation rate</span>
    <span class="s-value">0.66%</span>
    <span class="s-delta pos">▼ 0.1pp vs 2023</span>
    <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="0,12 9,14 18,10 27,16 36,13 45,11 54,15 63,9 72,13 81,17 90,12 100,14" /></svg>
  </div>
</div>

## Direction C — Hero + supporting

<div class="hero">
  <div class="hero-lead">
    <span class="s-label">On-time arrival rate</span>
    <span class="hero-value">58.1%</span>
    <span class="s-delta neg">▼ 2.3pp vs 2023</span>
    <span class="hero-note">Share of flights arriving within 15 minutes of schedule, across 344,827 flights in 2024.</span>
  </div>
  <div class="hero-side">
    <div class="hero-stat"><span class="s-label">Total flights</span><span class="s-value-sm">344,827</span></div>
    <div class="hero-stat"><span class="s-label">Cancellation rate</span><span class="s-value-sm">0.66%</span></div>
    <div class="hero-stat"><span class="s-label">Avg departure delay</span><span class="s-value-sm">7.7 min</span></div>
    <div class="hero-stat"><span class="s-label">Avg distance</span><span class="s-value-sm">740 mi</span></div>
    <div class="hero-stat"><span class="s-label">Carriers</span><span class="s-value-sm">15</span></div>
    <div class="hero-stat"><span class="s-label">Airports served</span><span class="s-value-sm">225</span></div>
  </div>
</div>

## Direction D — Grouped ledger

<div class="ledger">
  <div class="ledger-group">
    <span class="ledger-head">Volume</span>
    <div class="ledger-row"><span>Total flights</span><span class="ledger-val">344,827</span></div>
    <div class="ledger-row"><span>Flights per day</span><span class="ledger-val">942</span></div>
    <div class="ledger-row"><span>Busiest month</span><span class="ledger-val">August</span></div>
    <div class="ledger-row"><span>Avg distance</span><span class="ledger-val">740 mi</span></div>
  </div>
  <div class="ledger-group">
    <span class="ledger-head">Punctuality</span>
    <div class="ledger-row"><span>On-time arrival</span><span class="ledger-val">58.1%</span></div>
    <div class="ledger-row"><span>Avg departure delay</span><span class="ledger-val">7.7 min</span></div>
    <div class="ledger-row"><span>Cancellation rate</span><span class="ledger-val">0.66%</span></div>
    <div class="ledger-row"><span>Diversion rate</span><span class="ledger-val">0.25%</span></div>
  </div>
  <div class="ledger-group">
    <span class="ledger-head">Network</span>
    <div class="ledger-row"><span>Carriers</span><span class="ledger-val">15</span></div>
    <div class="ledger-row"><span>Airports served</span><span class="ledger-val">225</span></div>
    <div class="ledger-row"><span>Routes flown</span><span class="ledger-val">4,602</span></div>
    <div class="ledger-row"><span>Top hub</span><span class="ledger-val">ATL</span></div>
  </div>
</div>

<style>
  .s-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.07em; }
  .s-value { font-family: var(--font-ui); font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; color: var(--color-primary-strong); }
  .s-delta { font-family: var(--font-ui); font-size: 12px; font-weight: 500; }
  .s-delta.pos { color: #6d8a72; }
  .s-delta.neg { color: #b87470; }
  .s-delta.mut { color: var(--color-muted); }

  /* A: band */
  .band { display: flex; flex-wrap: wrap; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: var(--shadow-card); overflow: hidden; }
  .band-stat { flex: 1 1 140px; display: flex; flex-direction: column; gap: 5px; padding: 18px 22px; }
  .band-stat + .band-stat { border-left: 1px solid var(--color-border); }

  /* B: cards */
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  .card { display: flex; flex-direction: column; gap: 5px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: var(--shadow-card); padding: 16px 18px 12px; }
  .spark { width: 100%; height: 26px; margin-top: 8px; }
  .spark polyline { fill: none; stroke: #3D6B7E; stroke-width: 1.5; opacity: 0.75; }

  /* C: hero */
  .hero { display: flex; flex-wrap: wrap; gap: 40px; align-items: stretch; }
  .hero-lead { flex: 0 1 300px; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
  .hero-value { font-family: var(--font-ui); font-size: 56px; font-weight: 650; letter-spacing: -0.03em; line-height: 1; color: var(--color-primary-strong); }
  .hero-note { font-family: var(--font-ui); font-size: 13px; line-height: 1.45; color: var(--color-tertiary); margin-top: 4px; }
  .hero-side { flex: 1 1 380px; display: grid; grid-template-columns: 1fr 1fr 1fr; border-left: 1px solid var(--color-border-strong); padding-left: 40px; gap: 4px 28px; align-content: center; }
  .hero-stat { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; }
  .s-value-sm { font-family: var(--font-ui); font-size: 19px; font-weight: 600; letter-spacing: -0.015em; color: var(--color-primary-strong); }

  /* D: ledger */
  .ledger { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 48px; }
  .ledger-group { display: flex; flex-direction: column; }
  .ledger-head { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--color-tertiary); text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 6px; border-bottom: 1px solid var(--color-border-strong); }
  .ledger-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--color-border); font-family: var(--font-ui); font-size: 14px; color: var(--color-body); }
  .ledger-val { font-weight: 600; font-size: 15px; color: var(--color-primary-strong); font-variant-numeric: tabular-nums; }
</style>
