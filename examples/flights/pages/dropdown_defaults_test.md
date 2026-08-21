---
layout: dashboard
---

# Dropdown Defaults Test

```gsql test_carrier_options
from flights select carrier as code group by 1 order by 1
```

```gsql test_origin_options
from flights where carrier = $carrier select origin as code group by 1 order by 1
```

```gsql test_destination_options
from flights
where carrier = $carrier and origin = $origin
select destination as code group by 1 order by 1
```

<Row>
  <Dropdown title="Carrier" name="carrier" data="test_carrier_options" value="code" defaultValue="WN" />
  <Dropdown title="Origin" name="origin" data="test_origin_options" value="code" defaultValue="PHX" />
  <Dropdown title="Invalid comma default" name="excluded_invalid" data="test_destination_options" value="code" multiple=true defaultValue="LAX, LAS" />
  <Dropdown title="Valid array default" name="excluded_valid" data="test_destination_options" value="code" multiple=true defaultValue="['LAX', 'LAS']" />
  <Dropdown title="Year" name="year" defaultValue="2005">
    <DropdownOption value="2004" />
    <DropdownOption value="2005" />
  </Dropdown>
</Row>

```gsql invalid_result
from flights
where carrier = $carrier
  and origin = $origin
  and extract(year from dep_time) = cast($year as integer)
  and destination in ($excluded_invalid)
select destination, count() as flights
order by flights desc, destination
limit 10
```

```gsql valid_result
from flights
where carrier = $carrier
  and origin = $origin
  and extract(year from dep_time) = cast($year as integer)
  and destination in ($excluded_valid)
select destination, count() as flights
order by flights desc, destination
limit 10
```

<Row>
  <BarChart title="Comma string default" data="invalid_result" x="destination" y="flights" />
  <BarChart title="Array default" data="valid_result" x="destination" y="flights" />
</Row>
