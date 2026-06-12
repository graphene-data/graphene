---
title: Air Quality
layout: dashboard
---

```gsql measurements
from ambient_air_quality where has_pm25
```

<Row>
  <BigValue data=ambient_air_quality value="count()" title="Measurements" />
  <BigValue data=ambient_air_quality value=avg_pm25 title="Avg PM2.5" />
  <BigValue data=ambient_air_quality value="count(distinct country_name)" title="Countries" />
</Row>

```gsql highest_pm25_cities
from measurements
select city, country_name, round(avg(pm25_concentration), 1) as avg_pm25
where city is not null and country_name is not null
group by 1, 2
order by 3 desc
limit 20
```

<BarChart title="Highest Average PM2.5 by City" data=highest_pm25_cities x=city y=avg_pm25 splitBy=country_name />

```gsql yearly_pm25
from measurements
select year, round(avg(pm25_concentration), 1) as avg_pm25, count(distinct country_name) as countries
group by 1
order by 1
```

<LineChart title="Annual PM2.5 Coverage" data=yearly_pm25 x=year y=avg_pm25 y2=countries />
