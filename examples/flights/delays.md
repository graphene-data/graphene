
<Dropdown data="carriers" name="selected" label="name" value="code" defaultValue="AA" />

```gsql filtered_flights
from flights where carrier = $selected and carrier != $stuff
```

<BarChart data="filtered_flights" x="origin" y="avg(dep_delay)" />
