---
title: Bubble Map
description: Compare points of interest on a map using bubble size, and optionally color, to visualize metrics.
---

Compare points of interest on a map using bubble size, and optionally color, to visualize metrics. It is easier to distinguish size than color, so the primary metric should generally be used to set the size.

**Example:**

```html
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    size=sales 
    sizeFmt=eur
    value=sales 
    valueFmt=eur
    pointName=point_name 
/>
```


## Examples

### Custom Basemap
You can add a different basemap by passing in a basemap URL. You can find examples here: https://leaflet-extras.github.io/leaflet-providers/preview/

**Example:**

**Note:** you need to wrap the url in curly braces and backticks to avoid the curly braces in the URL being read as variables on your page

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    height=200 
    basemap={`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}`}
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
```

### Custom Tooltip

#### `tooltipType=hover`

**Example:**

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    size=sales 
    sizeFmt=usd 
    pointName=point_name 
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
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    size=sales 
    sizeFmt=usd 
    pointName=point_name 
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
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    value=sales 
    valueFmt=usd 
    pointName=point_name 
    colorPalette={['yellow','orange','red','darkred']}
/>
```

### Custom Styling

**Example:**

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    size=sales 
    sizeFmt=usd
    pointName=point_name 
    color=#128c2b
    opacity=1
    borderWidth=1
    borderColor=black
/>
```

### Max Bubble Size

**Example:**

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    size=sales 
    sizeFmt=usd
    pointName=point_name 
    maxSize=10
/>
```

### Link Drilldown
Pass in a `link` column to enable navigation on click of the point. These can be absolute or relative URLs

**Example:**

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    size=sales 
    sizeFmt=usd
    link=link_col 
/>
```

### Use Map as Input
Use the `name` prop to set an input name for the map - when a point is clicked, it will set the input value to that row of data

**Example:**

```svelte
<BubbleMap 
    data={la_locations} 
    lat=lat 
    long=long 
    size=sales 
    sizeFmt=usd
    name=my_point_map 
/>
```

*Click a point on the map to see the input value get updated:*

#### Selected value for `{inputs.my_point_map}`: 
  
<pre class="text-sm">{JSON.stringify(inputs.my_point_map, null, 2)}</pre>

#### Selected value for `{inputs.my_point_map.point_name}`: 
  
{inputs.my_point_map.point_name}


#### Filtered Data
<DataTable data={filtered_locations}>  	
    <Column id=id/> 	
    <Column id=point_name/> 	
    <Column id=lat/> 	
    <Column id=long/> 	
    <Column id=sales fmt=usd/> 	
</DataTable>

### Legends


#### Categorical Legend

**Example:**

```svelte
<BubbleMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
    size=sales
/>
```

#### Custom Colors
Set custom legend colors using the `colorPalette` prop to match the number of categories; excess categorical options will default to standard colors.

**Example:**

```svelte
<BubbleMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
    size=sales
    colorPalette={['#C65D47', '#5BAF7A', '#4A8EBA', '#D35B85', '#E1C16D', '#6F5B9A', '#4E8D8D']}
/>
```

#### Scalar Legend

**Example:**

```svelte
<BubbleMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    size=sales
    valueFmt=usd
/>
```

#### Custom Colors
Define scalar legend colors using the `colorPalette` prop, allowing specified colors to create a gradient based on the range of values.

**Example:**

```svelte
<BubbleMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    size=sales
    colorPalette={['#C65D47', '#4A8EBA']}
    valueFmt=usd
/>
```

## Options

### Bubbles

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | Query result, referenced using curly braces | true | query name | - |
| lat | Column containing latitude values | true | column name | - |
| long | Column containing longitude values | true | column name | - |
| size | Column that determines the size displayed for each point. | true | column name | - |
| sizeFmt | Format string for displaying the size value in tooltips. | false | format string | - |
| maxSize | Maximum size of the bubbles | false | number | 20 |
| value | Column that determines the value displayed at each point (used for color scale) | false | column name | - |
| valueFmt | Format string for displaying the value. | false | format string | - |
| pointName | Column containing the names/labels of the points - by default, this is shown as the title of the tooltip. | false | column name | - |
| title | Title for the map | false | string | - |
| subtitle | Subtitle - appears under the title | false | string | - |
| ignoreZoom | Stops map from zooming out to show all data for this layer | false | true, false | false |

### Color Scale

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| colorPalette | Array of colors used for theming the points based on data | array of colors | - |
| min | Minimum value to use for the color scale. | number | min of value column |
| max | Maximum value to use for the color scale. | number | max of value column |

### Legend

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| legend | Turns legend on or off | false | true, false | true |
| legendType | Appends a categorical or scalar legend to the map | false | categorical, scalar | - |
| legendPosition | Determines the legend's position on the map, with options provided | false | bottomLeft, topLeft, bottomRight, topRight | bottomLeft |

### Interactivity

| Property | Description | Options |
|----------|-------------|---------|
| link | URL to navigate to when a point is clicked. | URL |
| name | Input name. Can be referenced on your page with `{inputs.my_input_name}` | string |

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color for the points. Use when you want all points to be the same color. | CSS color value | - |
| borderWidth | Width of the border around each point. | pixel value | 0.75 |
| borderColor | Color of the border around each point. | CSS color value | white |
| opacity | Opacity of the points. | number between 0 and 1 | 0.8 |

### Selected State

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| selectedColor | When point is selected: Color for the points. Use when you want all points to be the same color. | CSS color value | - |
| selectedBorderWidth | When point is selected: Width of the border around each point. | pixel value | 0.75 |
| selectedBorderColor | When point is selected: Color of the border around each point. | CSS color value | white |
| selectedOpacity | When point is selected: Opacity of the points. | number between 0 and 1 | 0.8 |

### Tooltips

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| showTooltip | Whether to show tooltips | true, false | true |
| tooltipType | Determines whether tooltips are activated by hover or click. | hover, click | hover |
| tooltipClass | CSS class applied to the tooltip content. You can pass Tailwind classes into this prop to custom-style the tooltip | CSS class | - |
| tooltip | Configuration for tooltips associated with each area. See below example for format | array of objects | - |

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

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| basemap | URL template for the basemap tiles. | URL | - |
| attribution | Attribution text to display on the map (e.g., "© OpenStreetMap contributors"). | text | - |
| title | Optional title displayed above the map. | text | - |
| startingLat | Starting latitude for the map center. | latitude coordinate | - |
| startingLong | Starting longitude for the map center. | longitude coordinate | - |
| startingZoom | Initial zoom level of the map. | number (1 to 18) | - |
| height | Height of the map in pixels. | pixel value | 300 |
