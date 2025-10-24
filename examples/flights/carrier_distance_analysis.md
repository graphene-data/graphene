# Carrier Performance by Distance Tier

This dashboard analyzes which carriers have flown the most flights, broken down by different distance tiers. The analysis covers 341,961 completed flights (excluding cancelled and diverted flights) from 2000-2005.

## Distance Tier Breakdown

```sql distance_tier_summary
select 
  case 
    when distance < 200 then 'Short (< 200 miles)'
    when distance < 500 then 'Medium (200-499 miles)'
    when distance < 1000 then 'Long (500-999 miles)'
    when distance < 2000 then 'Very Long (1000-1999 miles)'
    else 'Ultra Long (2000+ miles)'
  end as distance_tier,
  count(*) as flight_count
from flights 
where cancelled = 'N' and diverted = 'N'
group by 1
order by flight_count desc
```

<Row>
  <BarChart data="distance_tier_summary" x="distance_tier" y="flight_count" title="Total Flights by Distance Tier" />
  <PieChart data="distance_tier_summary" category="distance_tier" value="flight_count" title="Flight Distribution by Distance" />
</Row>

## Carrier Performance by Distance Tier

```sql carrier_distance_analysis
select 
  carriers.name as carrier_name,
  case 
    when distance < 200 then 'Short (< 200 miles)'
    when distance < 500 then 'Medium (200-499 miles)'
    when distance < 1000 then 'Long (500-999 miles)'
    when distance < 2000 then 'Very Long (1000-1999 miles)'
    else 'Ultra Long (2000+ miles)'
  end as distance_tier,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N'
group by 1, 2
order by carrier_name, distance_tier
```

<BarChart data="carrier_distance_analysis" x="carrier_name" y="flight_count" groupBy="distance_tier" title="Flight Count by Carrier and Distance Tier" />

## Top Carriers by Distance Tier

```sql top_carriers_short
select 
  carriers.name as carrier_name,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N' and distance < 200
group by 1
order by 2 desc
limit 10
```

```sql top_carriers_medium
select 
  carriers.name as carrier_name,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N' and distance >= 200 and distance < 500
group by 1
order by 2 desc
limit 10
```

```sql top_carriers_long
select 
  carriers.name as carrier_name,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N' and distance >= 500 and distance < 1000
group by 1
order by 2 desc
limit 10
```

```sql top_carriers_very_long
select 
  carriers.name as carrier_name,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N' and distance >= 1000 and distance < 2000
group by 1
order by 2 desc
limit 10
```

```sql top_carriers_ultra_long
select 
  carriers.name as carrier_name,
  count(*) as flight_count
from flights 
join carriers on flights.carrier = carriers.code
where cancelled = 'N' and diverted = 'N' and distance >= 2000
group by 1
order by 2 desc
limit 10
```

<Row>
  <BarChart data="top_carriers_short" x="carrier_name" y="flight_count" title="Top Carriers: Short Flights (< 200 miles)" />
  <BarChart data="top_carriers_medium" x="carrier_name" y="flight_count" title="Top Carriers: Medium Flights (200-499 miles)" />
</Row>

<Row>
  <BarChart data="top_carriers_long" x="carrier_name" y="flight_count" title="Top Carriers: Long Flights (500-999 miles)" />
  <BarChart data="top_carriers_very_long" x="carrier_name" y="flight_count" title="Top Carriers: Very Long Flights (1000-1999 miles)" />
</Row>

<BarChart data="top_carriers_ultra_long" x="carrier_name" y="flight_count" title="Top Carriers: Ultra Long Flights (2000+ miles)" />

## Key Insights

### Overall Flight Distribution
- **Medium distance flights (200-499 miles)** dominate with 116,883 flights (34.2% of total)
- **Long distance flights (500-999 miles)** are second with 99,970 flights (29.2%)
- **Very long flights (1000-1999 miles)** account for 75,831 flights (22.2%)
- **Short flights (< 200 miles)** represent 35,690 flights (10.4%)
- **Ultra long flights (2000+ miles)** are least common with 13,587 flights (4.0%)

### Carrier Specializations
- **Southwest Airlines** dominates medium-distance flights with 46,544 flights
- **American Airlines** leads in very long flights with 14,157 flights
- **United Airlines** is strong in ultra long flights with 4,366 flights
- **American Eagle Airlines** specializes in short flights with 9,055 flights

### Market Leaders by Distance Tier
1. **Short Flights**: American Eagle Airlines (9,055), Atlantic Southeast Airlines (7,822)
2. **Medium Flights**: Southwest Airlines (46,544), US Airways (16,534)
3. **Long Flights**: Southwest Airlines (21,217), United Airlines (12,454)
4. **Very Long Flights**: American Airlines (14,157), Northwest Airlines (14,495)
5. **Ultra Long Flights**: United Airlines (4,366), American Airlines (3,001)
