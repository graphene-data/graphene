# Snowflake Restaurant Data Overview

```gsql summary
from establishments_open
select
  count() as total_establishments,
  avg(score) as avg_score,
  avg(review_count) as avg_reviews
```

```gsql contact_count
from contacts select count() as total_contacts
```

<Row>
  <BigValue data=summary value=total_establishments title="Establishments" />
  <BigValue data=contact_count value=total_contacts title="Contacts" />
  <BigValue data=summary value=avg_score title="Avg Rating" fmt="0.00" />
</Row>

## Establishments by State

```gsql by_state
from establishments_open
select location_state_code, count() as num
where location_state_code is not null
order by num desc
limit 15
```

<BarChart data=by_state x=location_state_code y=num />

## Rating Distribution

```gsql by_rating
from establishments_open
select score_rounded, count() as num
where score_rounded is not null
order by score_rounded
```

<BarChart data=by_rating x=score_rounded y=num />

## Price Range Distribution

```gsql by_price
from establishments_open
select price_symbolic, count() as num
where price_symbolic is not null
order by price_symbolic
```

<BarChart data=by_price x=price_symbolic y=num />

## Top Rated Establishments

```gsql top_establishments
from establishments_open
select name, location_city, location_state_code, score, review_count
where score is not null and review_count > 100
order by score desc, review_count desc
limit 20
```

<Table data=top_establishments />
