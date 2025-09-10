---
title: Sankey Diagram
description: Display flows of a metric transferring between different categories.
---

Use Sankey diagrams to display flows of a metric transferring between different categories.

To display a flow with multiple levels, like these examples, see [Mutli-level](#multi-level) below.



## Example

```svelte
<SankeyDiagram 
    data={query_name} 
    sourceCol= sourceCol
    targetCol = targetCol
    valueCol= valueCol
/>
```

## Vertical

```svelte
<SankeyDiagram 
    data={query_name} 
    sourceCol=sourceCol
    targetCol=targetCol
    valueCol=valueCol
    orient=vertical
/>
```

# Echarts Options String 

```svelte
<SankeyDiagram 
    data={traffic_data} 
    title="Sankey" 
    subtitle="A simple sankey chart" 
    sourceCol=source 
    targetCol=target 
    valueCol=count 
    echartsOptions={{
        title: {
            text: "Custom Echarts Option",
            textStyle: {
              color: '#476fff'
            }
        }
    }}
/>
```

# Node Depth Override


```svelte
<SankeyDiagram 
    data={apple_income_statement} 
    title="Apple Income Statement" 
    subtitle="USD Billions" 
    sourceCol=source 
    targetCol=target 
    valueCol=amount_usd 
    depthOverride={{'services revenue': 1}}
    nodeAlign=left
/>
```

# Labels

## Node Labels

### `nodeLabels=name` (default)

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  nodeLabels=name
/>
```

### `nodeLabels=value`

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  nodeLabels=value
/>
```

The value labels can be formatted using the `valueFmt` option.

### `nodeLabels=full`

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  nodeLabels=full
  valueFmt=usd
/>
```

## Link Labels

### `linkLabels=full` (default)
Requires `percentCol` to show percentage beside value

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  valueFmt=usd
  linkLabels=full
/>
```

### `linkLabels=value`

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  valueFmt=usd
  linkLabels=value
/>
```

### `linkLabels=percent`

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  valueFmt=usd
  linkLabels=percent
/>
```

## Custom Color Palette

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  linkColor=base-content-muted
  colorPalette={['#ad4940', '#3d8cc4', '#1b5218', '#ebb154']}
/>
```

## Link Colors

### `linkColor=base-content-muted` (default)

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  linkColor=base-content-muted
  colorPalette={['#ad4940', '#3d8cc4', '#1b5218', '#ebb154']}
/>
```

### `linkColor=source` 

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  linkColor=source
  colorPalette={['#ad4940', '#3d8cc4', '#1b5218', '#ebb154']}
/>
```

### `linkColor=target` 

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  linkColor=target
  colorPalette={['#ad4940', '#3d8cc4', '#1b5218', '#ebb154']}
/>
```

### `linkColor=gradient` 

```svelte
<SankeyDiagram 
  data={simple_sankey} 
  sourceCol=source 
  targetCol=target 
  valueCol=amount 
  percentCol=percent 
  linkColor=gradient
  colorPalette={['#6e0e08', '#3d8cc4', '#1b5218', '#ebb154']}
/>
```

## Multi-level

The syntax for multi-level sankey diagrams is the same, but the 
underlying query must represent all the levels using the same 
`sourceCol` and `targetCol`, so it is necessary to `union`
 each level together.  `sourceCol` nodes on the next level will be linked to `targetCol` nodes in the previous level with the same name.  

For example, here is the source for the visuals above.

```svelte
<SankeyDiagram
    data={traffic_data}
    title="Sankey"
    subtitle="A simple sankey chart"
    sourceCol=source
    targetCol=target
    valueCol=count
/>
```

## Options

### Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| sourceCol | Column to use for the source of the diagram | true | column name | - |
| targetCol | Column to use for the target of the diagram | true | column name | - |
| valueCol | Column to use for the value of the diagram | true | column name | - |
| percentCol | Column to use for the percent labels of the diagram | false | column name | - |
| depthOverride | Manual adjustment to location of each node `{{'services revenue': 2}}` | false | object containing node name and depth level (0 is first level) | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |
| printEchartsConfig | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options | false | ['true', 'false'] | "false" |

### Formatting & Styling

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| valueFmt | Format to use for `valueCol` ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| orient | Layout direction of the nodes in the diagram. | false | ['horizontal', 'vertical'] | "horizontal" |
| sort | Whether the nodes are sorted by size in the diagram | false | ['true', 'false'] | "false" |
| nodeAlign | Controls the horizontal alignment of nodes in the diagram. When orient is vertical, nodeAlign controls vertical alignment. | false | ['justify', 'left', 'right'] | "justify" |
| nodeGap | The gap between any two rectangles in each column of the the diagram. | false | number | 8 |
| nodeWidth | The node width of rectangle in the diagram. | false | number | 20 |
| outlineColor | Border color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | "transparent" |
| outlineWidth | Border Width. It should be a natural number. | false | number | 1 |
| colorPalette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` | false | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette |
| linkColor | Color to use for the links between nodes in the diagram | false | ['base-content-muted', 'source', 'target', 'gradient'] | "base-content-muted" |

### Chart

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| nodeLabels | Adds labels to the nodes of the diagram | false | ['name', 'value', 'full'] | "name" |
| linkLabels | Adds labels to the links between nodes | false | ['full', 'value', 'percent'] | "full (requires percentCol)" |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | 180 |

### Custom Echarts Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| echartsOptions | Custom Echarts options to override the default options. See [reference page](/components/charts/echarts-options) for available options. | false | `{{exampleOption:'exampleValue'}}` | - |
| printEchartsConfig | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options | false | ['true', 'false'] | "false" |
