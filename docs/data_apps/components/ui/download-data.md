---
title: Download Data
description: Display a standalone button to download a specified dataset as a CSV file.
---

Display a standalone button to download a specified dataset as a CSV file. Note that this component is not visible on small screen widths.

```categories
select category, sum(sales) as sales from needful_things.orders
group by all
order by sales desc
```

**Example:**

```svelte
<DownloadData data="categories"/>
```

## Examples

### Custom Text

```svelte
<DownloadData data="categories" text="Click Here"/>
```

### Custom Query ID

```svelte
<DownloadData data="categories" queryID=my_file/>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| display | Whether link is visible. If using as part of a custom component, you can pass a variable representing the hover state of your component to control visibility. | false | ['true', 'false'] | "true" |
| text | Label to show on the link | false | string | "Download" |
| queryID | Label to include as the start of the CSV filename. If no queryID is supplied, "evidence_download" is used. | false | string | - |
