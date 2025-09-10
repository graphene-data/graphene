---
title: Area Map
description: Compare a metric across different regions on a map using a choropleth map
---

Compare a metric across different regions on a map using a choropleth map

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
/>
```


## Examples

### Custom Basemap
You can add a different basemap by passing in a basemap URL. You can find examples here: https://leaflet-extras.github.io/leaflet-providers/preview/

**Example:**

**Note:** you need to wrap the url in curly braces and backticks to avoid the curly braces in the URL being read as variables on your page

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    basemap={`https://tile.openstreetmap.org/{z}/{x}/{y}.png`}
/>
```

### Using an Online GeoJSON


**Example:**

```svelte
<AreaMap 
    data={orders_by_state} 
    areaCol=state
    geoJsonUrl=https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_1_states_provinces.geojson
    geoId=name
    value=orders
/>
```

### Custom Tooltip

#### `tooltipType=hover`

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    tooltip={[
        {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'}
    ]}
/>
```

#### With clickable link and `tooltipType=click`

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    tooltipType=click
    tooltip={[
        {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'},
        {id: 'link_col', showColumnName: false, contentType: 'link', linkLabel: 'Click here', valueClass: 'font-bold mt-1'}
    ]}
/>
```

### Custom Styling

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    color=#fff5d9
    borderColor=#737373
    borderWidth=0.5
/>
```

### Custom Color Palette

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    colorPalette={[
        ['yellow', 'yellow'],
        ['orange', 'orange'],
        ['red', 'red'],
        ['darkred', 'darkred'],
    ]}
/>
```

### Link Drilldown
Pass in a `link` column to enable navigation on click of the point. These can be absolute or relative URLs

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    link=link_col
/>
```

### Use Map as Input
Use the `name` prop to set an input name for the map - when a point is clicked, it will set the input value to that row of data

**Example:**

```svelte
<AreaMap 
    data={la_zip_sales} 
    areaCol=zip_code
    geoJsonUrl='path/to/your/geoJson'
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
    height=250
    name=my_area_map
/>
```

*Click an area on the map to see the input value get updated:*

#### Selected value for `{inputs.my_area_map}`: 

<pre class="text-sm">{JSON.stringify(inputs.my_area_map, null, 2)}</pre>

#### Selected value for `{inputs.my_area_map.zip_code}`: 
  
{inputs.my_area_map.zip_code}


#### Filtered Data
<DataTable data={filtered_areas}>  	
    <Column id=id/> 	
    <Column id=zip_code fmt=id/> 	
    <Column id=sales fmt=usd/> 	
</DataTable>

### Legends


#### Categorical Legend

**Example:**

```svelte
<AreaMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
    geoId=ZCTA5CE10
    areaCol=zip_code
/>
```

#### Custom Colors
Set custom legend colors using the `colorPalette` prop to match the number of categories; excess categorical options will default to standard colors.

**Example:**

```svelte
<AreaMap
    data={grouped_locations}
    lat=lat
    long=long
    value=Category
    geoId=ZCTA5CE10
    areaCol=zip_code
    colorPalette={['#C65D47', '#5BAF7A', '#4A8EBA', '#D35B85', '#E1C16D', '#6F5B9A', '#4E8D8D']}
/>
```

#### Scalar Legend

**Example:**

```svelte
<AreaMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    geoId=ZCTA5CE10
    areaCol=zip_code
    valueFmt=usd
/>
```

#### Custom Colors
Define scalar legend colors using the `colorPalette` prop, allowing specified colors to create a gradient based on the range of values.

**Example:**

```svelte
<AreaMap
    data={grouped_locations}
    lat=lat
    long=long
    value=sales
    geoId=ZCTA5CE10
    areaCol=zip_code
    colorPalette={['#C65D47', '#4A8EBA']}
    valueFmt=usd
/>
```

## Required GeoJSON Data Structure
The GeoJSON data you pass to the map must be a feature collection. [See here for an example](https://gist.github.com/sgillies/1233327#file-geojson-spec-1-0-L50)

## Map Resources


Below are a selection of publically available GeoJSON files that may be useful for mapping. These are from the [Natural Earth Data](https://www.naturalearthdata.com) project, and hosted by [GeoJSON.xyz](https://geojson.xyz).

### Country, State, and City Locations

<DataTable data={useful_geojson_urls} rows=100>
    <Column id=file/>
    <Column id=category/>
    <Column id=scale/>
    <Column id=summary/>
    <Column id=size fmt='0.0,," MB"'/>
    <Column id=url contentType=link title=URL/>
</DataTable>

<Details title="All GeoJSON Files">

<DataTable data={all_geojson_urls} rows=all compact>
    <Column id=file/>
    <Column id=category/>
    <Column id=scale/>
    <Column id=summary/>
    <Column id=size fmt='0.0,," MB"'/>
    <Column id=url contentType=link title=URL/>
</DataTable>

</Details>

## Options

### Areas

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| data | Query result, referenced using curly braces | true | query name |
| geoJsonUrl | Path to source geoJSON data from - can be a URL (see Map Resources) or a file in your project. If the file is in your `static` directory in the root of your project, reference it as `geoJsonUrl="/your_file.geojson"` | true | URL |
| areaCol | Column in the data that specifies the area each row belongs to. | true | column name |
| geoId | Property in the GeoJSON that uniquely identifies each feature. | true | geoJSON property name |
| value | Column that determines the value displayed for each area (used for color scale) | false | column name |
| valueFmt | Format string for displaying the value. | false | format string |
| title | Title for the map | false | string |
| subtitle | Subtitle - appears under the title | false | string |
| ignoreZoom | Stops map from zooming out to show all data for this layer | false | true, false | false |

### Color Scale

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| colorPalette | Array of colors used for theming the areas based on data | array of colors | - |
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
| link | URL to navigate to when a area is clicked. | URL |
| name | Input name. Can be referenced on your page with `{inputs.my_input_name}` | string |

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color for the areas. Use when you want all areas to be the same color. | CSS color value | - |
| borderWidth | Width of the border around each area. | pixel value | 0.75 |
| borderColor | Color of the border around each area. | CSS color value | white |
| opacity | Opacity of the areas. | number between 0 and 1 | 0.8 |

### Selected State

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| selectedColor | When area is selected: Color for the areas. Use when you want all areas to be the same color. | CSS color value | - |
| selectedBorderWidth | When area is selected: Width of the border around each area. | pixel value | 0.75 |
| selectedBorderColor | When area is selected: Color of the border around each area. | CSS color value | white |
| selectedOpacity | When area is selected: Opacity of the areas. | number between 0 and 1 | 0.8 |

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

| Property | Description | Options |
|----------|-------------|---------|
| basemap | URL template for the basemap tiles. | URL |
| attribution | Attribution text to display on the map (e.g., "© OpenStreetMap contributors"). | text |
| title | Optional title displayed above the map. | text |
| startingLat | Starting latitude for the map center. | latitude coordinate |
| startingLong | Starting longitude for the map center. | longitude coordinate |
| startingZoom | Initial zoom level of the map. | number (1 to 18) |
| height | Height of the map in pixels. | pixel value | 300 |
