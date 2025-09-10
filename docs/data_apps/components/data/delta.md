---
title: Delta
description: Display an inline indicator that shows how a value has changed.
---

Use a Delta component to display an inline indicator that shows how a value has changed.


```markdown
This value is <Delta data={growth} column=positive fmt="+0.0%;-0.0%;0.0%" /> since last month.
```

## Examples

### Value Types

#### Positive

```markdown
<Delta data={growth} column=positive fmt=pct1 />
```

#### Negative 

```markdown
<Delta data={growth} column=negative fmt=pct1 />
```

#### Neutral*
*Values are not defined as neutral until you define a range using the `neutralMin` and `neutralMax` props

```markdown
<Delta data={growth} column=neutral fmt=pct1 neutralMin=-0.02 neutralMax=0.02 />
```

### Chips

#### Positive

```markdown
<Delta data={growth} column=growth fmt=pct1 chip=true />
```

#### Negative 

```markdown
<Delta data={growth} column=negative fmt=pct1 chip=true/>
```

#### Neutral*
*Values are not defined as neutral until you define a range using the `neutralMin` and `neutralMax` props

```markdown
<Delta data={growth} column=neutral fmt=pct1 chip=true neutralMin=-0.02 neutralMax=0.02 />
```

### Symbol Position

#### Symbol on Left

```html
<Delta data={growth} column=positive fmt=pct1 symbolPosition=left/>
```

#### Symbol on Left in Chip

```html
<Delta data={growth} column=positive fmt=pct1 chip=true symbolPosition=left/>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| column | Column to pull values from | false | column name | First column |
| row | Row number to display. 0 is the first row. | false | number | "0" |
| value | Pass a specific value to the component (e.g., value=100). Overridden by the data/column props. | false | number | - |
| fmt | Format to use for the value ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| downIsGood | If true, negative comparison values appear in green, and positive values appear in red. | false | ['true', 'false'] | "false" |
| showSymbol | Whether to show the up/down delta arrow symbol | false | ['true', 'false'] | "true" |
| showValue | Whether to show the value. Set this to false to show only the delta arrow indicator. | false | ['true', 'false'] | "true" |
| text | Text to display after the delta symbol and value | false | string | - |
| neutralMin | Start of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | "0" |
| neutralMax | End of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | "0" |
| chip | Whether to display the delta as a 'chip', with a background color and border. | false | ['true', 'false'] | "false" |
| symbolPosition | Whether to display the delta symbol to the left or right of the value | false | ['left', 'right'] | "right" |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |
