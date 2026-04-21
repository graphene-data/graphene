# NYC Taxi Origin-Destination Flows

Trip movement between pickup and dropoff neighborhoods in the NYC taxi sample.

```sql flow_summary
select
  count(*) as trips,
  count(distinct pickup_ntaname) as pickup_neighborhoods,
  count(distinct dropoff_ntaname) as dropoff_neighborhoods,
  count(distinct concat(pickup_ntaname, ' -> ', dropoff_ntaname)) as routes
from nyc_taxi
where pickup_ntaname is not null
  and dropoff_ntaname is not null
  and pickup_ntaname != ''
  and dropoff_ntaname != ''
```

<Row>
  <BigValue data=flow_summary value=trips title="Trips with OD" fmt=num0 />
  <BigValue data=flow_summary value=routes title="Routes" fmt=num0 />
  <BigValue data=flow_summary value=pickup_neighborhoods title="Pickup Areas" fmt=num0 />
  <BigValue data=flow_summary value=dropoff_neighborhoods title="Dropoff Areas" fmt=num0 />
</Row>

```sql flow_edges
select
  concat('Pickup: ', pickup_ntaname) as source,
  concat('Dropoff: ', dropoff_ntaname) as target,
  count(*) as trips
from nyc_taxi
where pickup_ntaname is not null
  and dropoff_ntaname is not null
  and pickup_ntaname != ''
  and dropoff_ntaname != ''
group by 1, 2
order by 3 desc
limit 40
```

<ECharts data=flow_edges height=640 renderer=canvas>
  title: {
    text: "Top Pickup to Dropoff Flows",
    left: "center",
  },
  tooltip: {
    trigger: "item",
  },
  series: [{
    type: "sankey",
    nodeAlign: "justify",
    draggable: false,
    left: 12,
    right: 140,
    top: 64,
    bottom: 20,
    layoutIterations: 64,
    emphasis: {
      focus: "adjacency",
    },
    encode: {
      source: "source",
      target: "target",
      value: "trips",
    },
    label: {
      fontSize: 11,
      overflow: "truncate",
      width: 130,
    },
    lineStyle: {
      color: "gradient",
      curveness: 0.5,
      opacity: 0.35,
    },
  }],
</ECharts>

```sql top_pickups
select
  pickup_ntaname,
  count(*) as trips,
  avg(total_amount) as avg_total_amount
from nyc_taxi
where pickup_ntaname is not null
  and pickup_ntaname != ''
group by 1
order by 2 desc
limit 12
```

```sql top_dropoffs
select
  dropoff_ntaname,
  count(*) as trips,
  avg(total_amount) as avg_total_amount
from nyc_taxi
where dropoff_ntaname is not null
  and dropoff_ntaname != ''
group by 1
order by 2 desc
limit 12
```

<Row>
  <BarChart title="Top Pickup Neighborhoods" data=top_pickups x=pickup_ntaname y=trips />
  <BarChart title="Top Dropoff Neighborhoods" data=top_dropoffs x=dropoff_ntaname y=trips />
</Row>

```sql top_routes
select
  pickup_ntaname as pickup,
  dropoff_ntaname as dropoff,
  count(*) as trips,
  avg(trip_distance) as avg_distance,
  avg(trip_minutes) as avg_minutes,
  avg(total_amount) as avg_total_amount
from nyc_taxi
where pickup_ntaname is not null
  and dropoff_ntaname is not null
  and pickup_ntaname != ''
  and dropoff_ntaname != ''
group by 1, 2
order by 3 desc
limit 25
```

<Table data=top_routes title="Top Origin-Destination Routes" rows=25 compact=true search=true totalRow=true>
  <Column id=pickup title="Pickup" />
  <Column id=dropoff title="Dropoff" />
  <Column id=trips title="Trips" fmt=num0 />
  <Column id=avg_distance title="Avg Distance" fmt=num1 />
  <Column id=avg_minutes title="Avg Minutes" fmt=num1 />
  <Column id=avg_total_amount title="Avg Fare" fmt=usd2 />
</Table>
