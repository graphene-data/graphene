# NYC Taxi Overview

ClickHouse sample dashboard over `default.nyc_taxi`.

<Row>
  <BigValue data=nyc_taxi value=count(*) title="Trips" fmt=num0 />
  <BigValue data=nyc_taxi value=avg(total_amount) title="Avg Fare" fmt=usd2 />
  <BigValue data=nyc_taxi value=p50(total_amount) title="Median Fare" fmt=usd2 />
</Row>

```sql weekly_trips
select
  date_trunc('week', pickup_datetime) as pickup_week,
  count(*) as trips,
  avg(total_amount) as avg_total_amount
from nyc_taxi
group by 1
order by 1 asc
limit 12
```

<LineChart title="Weekly Taxi Trips" data=weekly_trips x=pickup_week y=trips y2=avg_total_amount y2Fmt=usd2 />

```sql payment_mix
select
  payment_type,
  count(*) as trips
from nyc_taxi
group by 1
order by 2 desc
limit 5
```

<BarChart title="Trips by Payment Type" data=payment_mix x=payment_type y=trips />
