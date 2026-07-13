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
/* Cloud does not host user assets yet, so embed 330px previews while keeping the full-size source images checked in. */
.ed-plate-img-ops { background-image: url('data:image/webp;base64,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'); }
.ed-plate-img-carrier { background-image: url('data:image/webp;base64,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'); }
.ed-plate-img-delay { background-image: url('data:image/webp;base64,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'); }
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
