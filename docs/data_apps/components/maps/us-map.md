---
title: US Map
description: Compare a metric across US states using a flat choropleth map.
---

Compare a metric across US states using a flat choropleth map. For other regions see the more general [Area Map](/components/maps/area-map) component.

**Example:**

```html
<USMap
    data="state_population"
    state=state_name
    value=population
/>
```

## Examples

### Color Scales

`colorScale=info`

**Example:**

````html
<USMap
    data="state_population"
    state=state_name
    value=population
    colorScale=info
/>
````

`colorScale=positive`

**Example:**

````html
<USMap
    data="state_population"
    state=state_name
    value=population
    colorScale=positive
/>
````

`colorScale=negative`

**Example:**

````html
<USMap
    data="state_population"
    state=state_name
    value=population
    colorScale=negative
/>
````

### Custom Color Scale

**Example:**

```svelte
<USMap
    data="state_population"
    state=state_name
    value=population
    colorScale={['maroon','white','#1c0d80']}
    legend=true
/>
```

### Legend

#### Default

**Example:**

```html
<USMap
    data="state_population"
    state=state_name
    value=population
    legend=true
/>
```

#### With Filter

**Example:**

````svelte
<USMap
    data="state_population"
    state=state_name
    value=population
    colorScale={['maroon','white','#1c0d80']}
    legend=true
    filter=true
/>
````

### Links

**Example:**

```html
<USMap
	data="state_current"
	state=state
	value=value
	abbreviations=true
	link=state_link
	title="Sales by State"
	subtitle={{most_recent_month[0].month}}
/>
```

### State Abbreviations

**Example:**

```html
<USMap data="map_data" state=state_abbrev value=sales_usd abbreviations=true />
```

## Options

### Data

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| data | ✓ | query name | Query name, wrapped in curly braces |
| state | ✓ | column name | Column to be used as the name for each state |
| abbreviations | | false/true (default: false) | If true, map will look for two letter abbreviations rather than full names |
| value | ✓ | column name | Column to be used as the value determining the colour of each state |
| colorScale | | | Colour scale to be used. To use a custom color palette, see the `colorPalette` prop (default: info) |
| colorPalette | | array of color codes (can be CSS, hex, RGB, HSL) | Custom color palette to use for setting state colors. Overrides `colorScale`. E.g., `{['#cf0d06','#eb5752','#e88a87']}` |
| min | | number | Minimum value for the colour scale. Anything below the minimum will be shown in the same colour as the min value |
| max | | number | Maximum value for the colour scale. Anything above the maximum will be shown in the same colour as the max value |
| title | | string | Title appearing above the map. Is included when you click to save the map image |
| subtitle | | string | Subtitle appearing just above the map. Is included when you click to save the map image |
| link | | column name | Column containing links. When supplied, allows you to click each state on the map and navigate to the link |
| fmt | | Excel-style format \| built-in format \| custom format | Format to use for values ([see available formats](/core-concepts/formatting)) |
| legend | | true/false (default: false) | Whether to show a legend at the top of the map |
| filter | | true/false (default: false) | Whether to include filter controls on the legend. Can only be used when legend = true |
| emptySet | | error/warn/pass (default: error) | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to `error`, empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string (default: "No records") | Text to display when an empty dataset is received - only applies when `emptySet` is `warn` or `pass`, or when the empty dataset is a result of an input component change (dropdowns, etc.). |
| renderer | | canvas/svg (default: canvas) | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg). |
| downloadableData | | true/false (default: true) | Whether to show the download button to allow users to download the data |
| downloadableImage | | true/false (default: true) | Whether to show the button to allow users to save the chart as an image |

### Custom Echarts Options

| Property | Type | Description |
|----------|------|-------------|
| echartsOptions | `{{exampleOption:'exampleValue'}}` | Custom Echarts options to override the default options. See [reference page](/components/charts/echarts-options) for available options. |
| seriesOptions | `{{exampleSeriesOption:'exampleValue'}}` | Custom Echarts options to override the default options for all series in the chart. This loops through the series to apply the settings rather than having to specify every series manually using `echartsOptions` See [reference page](/components/charts/echarts-options) for available options. |
| printEchartsConfig | true/false (default: false) | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options |

### Interactivity

| Property | Type | Description |
|----------|------|-------------|
| connectGroup | | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected |
