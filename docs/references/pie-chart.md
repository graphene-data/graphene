Use a pie chart to show part-to-whole relationships across categories. Best for a small number of categories where proportions are easy to compare.

Here's an example:

```markdown
<PieChart
  title="Sales share by category"
  data=orders_by_category_2021
  category=category
  value=sales
/>
```

# Attributes

## General

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| title | Chart title. Appears at top left of chart. | string | - |
| subtitle | Chart subtitle. Appears just under title. | string | - |

## Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| category | Column or expression to use for slice names | true | column name, stored expression name, GSQL expression | - |
| value | Column or expression to use for slice values | true | column name, stored expression name, GSQL expression | - |
