---
layout: dashboard
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');

.ed-wrap {
  font-family: 'Inter', sans-serif;
}
.ed-masthead {
  text-align: center;
  padding: 48px 0 36px;
  border-bottom: 1px solid #1c1917;
}
.ed-masthead .ed-rule {
  width: 48px;
  height: 3px;
  background: #b45309;
  margin: 0 auto 24px;
}
.ed-masthead h1 {
  font-family: 'Fraunces', serif;
  font-size: 52px;
  font-weight: 600;
  color: #1c1917;
  margin: 0 0 16px;
  line-height: 1.05;
  border: none;
}
.ed-masthead .ed-dek {
  font-size: 17px;
  color: #57534e;
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.65;
}
.ed-masthead .ed-dateline {
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #b45309;
  margin: 20px 0 0;
}

/* ---- Figures band ---- */
.ed-figures {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #d6d3d1;
  margin-bottom: 48px;
}
.ed-figure {
  text-align: center;
  padding: 28px 12px;
  border-right: 1px solid #d6d3d1;
}
.ed-figure:last-child { border-right: none; }
.ed-figure-value {
  display: block;
  font-family: 'Fraunces', serif;
  font-size: 40px;
  font-weight: 700;
  color: #1c1917;
}
.ed-figure-label {
  display: block;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #78716c;
  margin-top: 6px;
}

/* ---- Section headers ---- */
.ed-section-title {
  font-family: 'Fraunces', serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #1c1917;
  text-align: center;
  margin: 0 0 28px;
  border: none;
}

/* ---- Dashboard plates ---- */
.ed-plates {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 56px;
}
.ed-plate {
  display: block;
  text-decoration: none;
  border: 1px solid #d6d3d1;
  background: #ffffff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.ed-plate:hover {
  text-decoration: none;
  border-color: #1c1917;
  box-shadow: 0 12px 32px rgba(28, 25, 23, 0.12);
}
.ed-plate:hover h3 { color: #b45309; }
.ed-plate-img {
  aspect-ratio: 16 / 10;
  background-size: cover;
  background-position: top center;
  border-bottom: 1px solid #d6d3d1;
}
.ed-plate-img-ops { background-image: url('/assets/preview_operations_overview.png'); }
.ed-plate-img-carrier { background-image: url('/assets/preview_carrier_detail.png'); }
.ed-plate-img-delay { background-image: url('/assets/preview_delay_factors.png'); }
.ed-plate-body {
  padding: 18px 20px 22px;
}
.ed-plate-num {
  font-family: 'Fraunces', serif;
  font-size: 13px;
  color: #b45309;
  letter-spacing: 0.14em;
}
.ed-plate h3 {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 600;
  color: #1c1917;
  margin: 6px 0 8px;
  transition: color 0.15s ease;
}
.ed-plate p {
  font-size: 14px;
  line-height: 1.6;
  color: #57534e;
  margin: 0;
}

/* ---- ERD ---- */
.ed-erd-section {
  border-top: 1px solid #1c1917;
  padding-top: 36px;
  margin-bottom: 24px;
}
.ed-erd {
  max-width: 820px;
  margin: 0 auto;
}
.ed-erd-row {
  display: flex;
  align-items: center;
}
.ed-erd-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ed-table {
  border: 1px solid #a8a29e;
  background: #ffffff;
  width: 190px;
  flex: none;
}
.ed-table-hub {
  border: 2px solid #1c1917;
  box-shadow: 4px 4px 0 #e7e5e4;
  width: 220px;
}
.ed-table-name {
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  color: #1c1917;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e7e5e4;
}
.ed-table-hub .ed-table-name {
  background: #1c1917;
  color: #fafaf9;
  border-bottom: none;
}
.ed-table-grain {
  display: block;
  font-size: 11px;
  font-style: italic;
  color: #78716c;
  padding: 6px 14px 2px;
}
.ed-table-fields {
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  line-height: 1.7;
  color: #57534e;
  padding: 2px 14px 10px;
}
.ed-join-h {
  flex: 1;
  position: relative;
  border-top: 1px solid #a8a29e;
  margin: 0 -1px;
}
.ed-join-h .ed-join-label {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
.ed-join-v {
  position: relative;
  width: 1px;
  height: 44px;
  background: #a8a29e;
}
.ed-join-v .ed-join-label {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  white-space: nowrap;
}
.ed-join-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #b45309;
  background: #fafaf9;
  padding: 0 4px;
}
.ed-erd-caption {
  text-align: center;
  font-size: 13px;
  font-style: italic;
  color: #78716c;
  margin: 28px 0 0;
}
.ed-colophon {
  border-top: 1px solid #d6d3d1;
  margin-top: 40px;
  padding-top: 18px;
  font-size: 13px;
  color: #78716c;
  text-align: center;
}
</style>

```gsql totals
from flights select
  count() as flights,
  count(distinct carrier) as carriers,
  count(distinct origin) as airports,
  count(distinct tail_num) as aircraft
```

<div class="ed-wrap">

<div class="ed-masthead">
  <div class="ed-rule"></div>
  <h1>Six Years of<br>American Aviation</h1>
  <p class="ed-dek">An analytical record of FAA commercial flight operations — every departure, delay, and cancellation from the first half of the decade.</p>
  <p class="ed-dateline">2000 — 2005 · FAA On-Time Performance Data</p>
</div>

<div class="ed-figures">
  <div class="ed-figure"><span class="ed-figure-value"><Value data=totals column=flights /></span><span class="ed-figure-label">Flights</span></div>
  <div class="ed-figure"><span class="ed-figure-value"><Value data=totals column=carriers /></span><span class="ed-figure-label">Carriers</span></div>
  <div class="ed-figure"><span class="ed-figure-value"><Value data=totals column=airports /></span><span class="ed-figure-label">Airports</span></div>
  <div class="ed-figure"><span class="ed-figure-value"><Value data=totals column=aircraft /></span><span class="ed-figure-label">Aircraft</span></div>
</div>

<h2 class="ed-section-title">Contents</h2>

<div class="ed-plates">
  <a class="ed-plate" href="/pages/operations_overview">
    <div class="ed-plate-img ed-plate-img-ops"></div>
    <div class="ed-plate-body">
      <span class="ed-plate-num">PLATE 01</span>
      <h3>Flight Operations Overview</h3>
      <p>Top-line KPIs, monthly volume, a delay heatmap by hour and day-of-week, and a ranked table of carriers.</p>
    </div>
  </a>
  <a class="ed-plate" href="/pages/carrier_detail">
    <div class="ed-plate-img ed-plate-img-carrier"></div>
    <div class="ed-plate-body">
      <span class="ed-plate-num">PLATE 02</span>
      <h3>Carrier Detail</h3>
      <p>Any airline's rank, fleet, delay distribution, and monthly trend measured against the rest of the industry.</p>
    </div>
  </a>
  <a class="ed-plate" href="/pages/delay_factors">
    <div class="ed-plate-img ed-plate-img-delay"></div>
    <div class="ed-plate-body">
      <span class="ed-plate-num">PLATE 03</span>
      <h3>What makes your flight late?</h3>
      <p>A notebook investigating what actually predicts a late departure — hour of day, airline, origin airport, day of week. One factor dominates.</p>
    </div>
  </a>
</div>

<div class="ed-erd-section">

<h2 class="ed-section-title">The Source Data</h2>

<div class="ed-erd">
  <div class="ed-erd-row">
    <div class="ed-table">
      <span class="ed-table-name">carriers</span>
      <span class="ed-table-grain">one airline</span>
      <span class="ed-table-fields">code · name · nickname</span>
    </div>
    <div class="ed-join-h"><span class="ed-join-label">carrier</span></div>
    <div class="ed-table ed-table-hub">
      <span class="ed-table-name">flights</span>
      <span class="ed-table-grain">one scheduled flight</span>
      <span class="ed-table-fields">dep_delay · arr_delay · cancelled · aircraft_age</span>
    </div>
    <div class="ed-join-h"><span class="ed-join-label">origin · dest</span></div>
    <div class="ed-table">
      <span class="ed-table-name">airports</span>
      <span class="ed-table-grain">one FAA facility</span>
      <span class="ed-table-fields">code · city · state · lat / long · major</span>
    </div>
  </div>
  <div class="ed-erd-col">
    <div class="ed-join-v"><span class="ed-join-label">tail_num</span></div>
    <div class="ed-table">
      <span class="ed-table-name">aircraft</span>
      <span class="ed-table-grain">one registered tail number</span>
      <span class="ed-table-fields">tail_num · year_built · owner</span>
    </div>
    <div class="ed-join-v"><span class="ed-join-label">model</span></div>
    <div class="ed-table">
      <span class="ed-table-name">aircraft_models</span>
      <span class="ed-table-grain">one aircraft model</span>
      <span class="ed-table-fields">manufacturer · model · seats · engines · speed</span>
    </div>
  </div>
</div>

<p class="ed-erd-caption">Fig. 1 — Five tables in /tables, joined into a star around flights.</p>

</div>

<p class="ed-colophon">Built with Graphene · GSQL models define the joins, dimensions, and measures used across every page.</p>

</div>
