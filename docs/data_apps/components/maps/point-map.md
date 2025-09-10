---
title: Point Map
description: Display points of interest on a map, optionally color-coded by a metric.
---

Show points of interest on a map, optionally color-coded by a metric.

**Example:**

```html
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long  
    pointName=point_name 
    height=200
/>
```


## Examples

### Custom Basemap
You can add a different basemap by passing in a basemap URL. You can find examples here: https://leaflet-extras.github.io/leaflet-providers/preview/

**Example:**

**Note:** you need to wrap the url in curly braces and backticks to avoid the curly braces in the URL being read as variables on your page

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    height=200 
    basemap={`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}`}
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
/>
```

### Custom Tooltip

#### `tooltipType=hover`

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    height=200
    tooltipType=hover
    tooltip={[
        {id: 'point_name', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'}    
    ]}
/>
```

#### With clickable link and `tooltipType=click`

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    height=200
    tooltipType=click
    tooltip={[
        {id: 'point_name', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'},
        {id: 'link_col', showColumnName: false, contentType: 'link', linkLabel: 'Click here', valueClass: 'font-bold mt-1'}
    ]}
/>
```

### Custom Color Palette

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    height=200
    colorPalette={['yellow','orange','red','darkred']}
/>
```

### Custom Styling

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    pointName=point_name 
    height=200
    color=#128c2b
    size=10
    opacity=0.6
    borderWidth=0
/>
```

### Link Drilldown
Pass in a `link` column to enable navigation on click of the point. These can be absolute or relative URLs

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    link=link_col 
    height=200
/>
```

### Use Map as Input
Use the `name` prop to set an input name for the map - when a point is clicked, it will set the input value to that row of data

**Example:**

```svelte
<PointMap 
    data={la_locations} 
    lat=lat 
    long=long 
    name=my_point_map 
    height=200
/>
```

*Click a point on the map to see the input value get updated:*

#### Selected value for `{inputs.my_point_map}`: 
  
<pre class="text-sm">{JSON.stringify(inputs.my_point_map, null, 2)}</pre>

#### Selected value for `{inputs.my_point_map.point_name}`: 
  
{inputs.my_point_map.point_name}


#### Filtered Data

| id | point_name | lat | long | sales |
|----|------------|-----|------|-------|
| {filtered_locations.id} | {filtered_locations.point_name} | {filtered_locations.lat} | {filtered_locations.long} | {filtered_locations.sales} |

### Legends


#### Categorical Legend

**Example:**

```svelte
<PointMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
/>
```

#### Custom Colors
Set custom legend colors using the `colorPalette` prop to match the number of categories; excess categorical options will default to standard colors.

**Example:**

```svelte
<PointMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
    colorPalette={['#C65D47', '#5BAF7A', '#4A8EBA', '#D35B85', '#E1C16D', '#6F5B9A', '#4E8D8D']}
/>
```

#### Scalar Legend

**Example:**

```svelte
<PointMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    valueFmt=usd
/>
```

#### Custom Colors
Define scalar legend colors using the `colorPalette` prop, allowing specified colors to create a gradient based on the range of values.

**Example:**

```svelte
<PointMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    valueFmt=usd
    colorPalette={['#C65D47', '#4A8EBA']}
/>
```

## Options

### Points

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| data | ✓ | query name | Query result, referenced using curly braces |
| value | | column name | Column that determines the value displayed at each point. |
| valueFmt | | format string | Format string for displaying the value. |
| pointName | | column name | Column containing the names/labels of the points - by default, this is shown as the title of the tooltip. |
| title | | string | Title for the map |
| subtitle | | string | Subtitle - appears under the title |
| ignoreZoom | | true/false (default: false) | Stops map from zooming out to show all data for this layer |

### Color Scale

| Property | Type | Description |
|----------|------|-------------|
| colorPalette | array of colors | Array of colors used for theming the points based on data |
| min | number | Minimum value to use for the color scale. |
| max | number | Maximum value to use for the color scale. |

### Legend

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| legend | true/false | true | Turns legend on or off |
| legendType | categorical/scalar | | Appends a categorical or scalar legend to the map |
| legendPosition | bottomLeft/topLeft/bottomRight/topRight | bottomLeft | Determines the legend's position on the map, with options provided |

### Interactivity

| Property | Type | Description |
|----------|------|-------------|
| link | URL | URL to navigate to when a point is clicked. |
| name | string | Input name. Can be referenced on your page with `{inputs.my_input_name}` |

### Styling
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| color | CSS color value | | Color for the points. Use when you want all points to be the same color. |
| size | number | 5 | Size of the points |
| borderWidth | pixel value | | Width of the border around each point. |
| borderColor | CSS color value | | Color of the border around each point. |
| opacity | number between 0 and 1 | | Opacity of the points. |

### Selected State

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| selectedColor | CSS color value | | When point is selected: Color for the points. Use when you want all points to be the same color. |
| selectedBorderWidth | pixel value | 0.75 | When point is selected: Width of the border around each point. |
| selectedBorderColor | CSS color value | white | When point is selected: Color of the border around each point. |
| selectedOpacity | number between 0 and 1 | 0.8 | When point is selected: Opacity of the points. |

### Tooltips
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| showTooltip | boolean | true | Whether to show tooltips |
| tooltipType | hover/click | hover | Determines whether tooltips are activated by hover or click. |
| tooltipClass | CSS class | | CSS class applied to the tooltip content. You can pass Tailwind classes into this prop to custom-style the tooltip |
| tooltip | array of objects | | Configuration for tooltips associated with each area. See below example for format |

#### `tooltip` example:

```javascript
tooltip={[
    {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'},
    {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'},
    {id: 'zip_code', showColumnName: false, contentType: 'link', linkLabel: 'Click here', valueClass: 'font-bold mt-1'}
]}
```

#### All options available in `tooltip`:
- `id`: column ID
- `title`: custom string to use as title of field
- `fmt`: format to use for value
- `showColumnName`: whether to show the column name. If `false`, only the value will be shown
- `contentType`: currently can only be "link"
- `linkLabel`: text to show for a link when contentType="link"
- `formatColumnTitle`: whether to automatically uppercase the first letter of the title. Only applies when `title` not passed explicitly
- `valueClass`: custom Tailwind classes to style the values
- `fieldClass`: custom Tailwind classes to style the column names

### Base Map

| Property | Type | Description |
|----------|------|-------------|
| basemap | URL | URL template for the basemap tiles. |
| attribution | text | Attribution text to display on the map (e.g., "© OpenStreetMap contributors"). |
| title | text | Optional title displayed above the map. |
| startingLat | latitude coordinate | Starting latitude for the map center. |
| startingLong | longitude coordinate | Starting longitude for the map center. |
| startingZoom | number (1 to 18) | Initial zoom level of the map. |
| height | pixel value | 300 | Height of the map in pixels. |
