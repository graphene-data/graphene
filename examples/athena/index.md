# Athena flights

```gsql delayed_carriers
from flights select carrier, sum(dep_delay) as total_delay where refund_eligible order by 2 desc
```

<BarChart data=delayed_carriers x=carrier y=total_delay />
