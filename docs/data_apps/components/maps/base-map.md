---
title: Base Map
description: Combine multiple map layers including areas, points, and bubbles.
---

Combine multiple map layers including areas, points, and bubbles.

**Example:**

```html
<BaseMap>
  <Areas data="la_zip_sales" geoId=ZCTA5CE10 areaCol=zip_code value=sales valueFmt=usd/>
  <Points data="la_locations" lat=lat long=long color=#179917/>
</BaseMap>
```


## Overview
The BaseMap component provides a flexible and extensible way to create maps with multiple layers. This component serves as the foundation for AreaMap, PointMap, and BubbleMap.

Within BaseMap, you can add layers using the following components:
- `<Areas/>`
- `<Points/>`
- `<Bubbles/>`

## Examples

See the pages for [Area Map](/components/maps/area-map), [Point Map](/components/maps/point-map), and [Bubble Map](/components/maps/bubble-map) for examples specific to those layers. The same options can be applied to the layer components within BaseMap.

### Adding Multiple Layers

**Example:**

```svelte
<BaseMap>
  <Areas 
    data="la_zip_sales"
    areaCol=zip_code
    geoJsonUrl="path/to/your/geoJSON"
    geoId=ZCTA5CE10
    value=sales
    valueFmt=usd
  />
  <Bubbles 
    data="la_locations"
    lat=lat
    long=long
    size=sales
    sizeFmt=usd
    value=sales
    valueFmt=usd
    pointName=point_name
    colorPalette={['yellow','orange','red','darkred']}
    opacity=0.5
  />
</BaseMap>
```

### Custom Basemap
You can add a different basemap by passing in a basemap URL. You can find examples here: https://leaflet-extras.github.io/leaflet-providers/preview/

**Example:**

```svelte
<BaseMap basemap="`https://tile.openstreetmap.org/{z"/{x}/{y}.png`} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'>
    <Points 
        data="la_locations"
        lat=lat
        long=long
        value=sales
        valueFmt=usd
        pointName=point_name
        color=violet
        borderColor=black
        borderWidth=2
    />
</BaseMap>
```

### Custom Tooltip

#### `tooltipType=hover`

**Example:**

```svelte
<BaseMap>
    <Areas 
        data="la_zip_sales" 
        areaCol=zip_code
        geoJsonUrl='/geo-json/ca_california_zip_codes_geo_1.min.json'
        geoId=ZCTA5CE10
        value=sales
        valueFmt=usd
        height=250
        tooltip="[
            {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'",
            {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'},
            {id: 'zip_code', showColumnName: false, contentType: 'link', linkLabel: 'Click here', valueClass: 'font-bold mt-1'}
        ]}
    />
</BaseMap>
```

#### With clickable link and `tooltipType=click`

**Example:**

```svelte
<BaseMap>
    <Areas 
        data="la_zip_sales" 
        areaCol=zip_code
        geoJsonUrl='/geo-json/ca_california_zip_codes_geo_1.min.json'
        geoId=ZCTA5CE10
        value=sales
        valueFmt=usd
        height=250
        tooltipType=click
        tooltip="[
            {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'",
            {id: 'sales', fmt: 'eur', fieldClass: 'text-[grey]', valueClass: 'text-[green]'},
            {id: 'link_col', showColumnName: false, contentType: 'link', linkLabel: 'Click here', valueClass: 'font-bold mt-1'}
        ]}
    />
</BaseMap>
```

## Map Resources


Below are a selection of publically available GeoJSON files that may be useful for mapping. These are from the [Natural Earth Data](https://www.naturalearthdata.com) project, and hosted by [GeoJSON.xyz](https://geojson.xyz).

### Country, State, and City Locations

| file | category | scale | summary | size | url |
|------|----------|-------|---------|------|-----|
| {useful_geojson_urls.file} | {useful_geojson_urls.category} | {useful_geojson_urls.scale} | {useful_geojson_urls.summary} | {useful_geojson_urls.size} | {useful_geojson_urls.url} |

<details>
<summary>All GeoJSON Files</summary>

| file | category | scale | summary | size | url |
|------|----------|-------|---------|------|-----|
| {all_geojson_urls.file} | {all_geojson_urls.category} | {all_geojson_urls.scale} | {all_geojson_urls.summary} | {all_geojson_urls.size} | {all_geojson_urls.url} |

</details>

## Base Map Options

| Property | Type | Description |
|----------|------|-------------|
| basemap | URL | URL template for the basemap tiles. |
| attribution | text | Attribution text to display on the map (e.g., "© OpenStreetMap contributors"). |
| title | text | Optional title displayed above the map. |
| startingLat | latitude coordinate | Starting latitude for the map center. |
| startingLong | longitude coordinate | Starting longitude for the map center. |
| startingZoom | number (1 to 18) | Initial zoom level of the map. |
| height | pixel value (default: 300) | Height of the map in pixels. |
| title | string | Title for the map |
| subtitle | string | Subtitle - appears under the title |

## Layer Options

### Areas
Use the `<Areas/>` component to add an area layer

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| data | ✓ | query name | Query result, referenced using curly braces. |
| geoJsonUrl | ✓ | URL | Path to source geoJSON data from - can be a URL (see [Map Resources](#map-resources)) or a file in your project. If the file is in your `static` directory in the root of your project, reference it as `geoJsonUrl="/your_file.geojson"` |
| areaCol | ✓ | column name | Column in the data that specifies the area each row belongs to. |
| geoId | ✓ | geoJSON property name | Property in the GeoJSON that uniquely identifies each feature. |
| value | | column name | Column that determines the value displayed for each area (used for color scale). |
| valueFmt | | format string | Format string for displaying the value. |
| ignoreZoom | | true/false (default: false) | Stops map from zooming out to show all data for this layer |

### Points
Use the `<Points/>` component to add an area layer

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| data | ✓ | query name | Query result, referenced using curly braces. |
| lat | ✓ | column name | Column containing latitude values. |
| long | ✓ | column name | Column containing longitude values. |
| value | | column name | Column that determines the value displayed at each point. |
| valueFmt | | format string | Format string for displaying the value. |
| pointName | | column name | Column containing the names/labels of the points - by default, this is shown as the title of the tooltip. |
| ignoreZoom | | true/false (default: false) | Stops map from zooming out to show all data for this layer |

### Bubbles
Use the `<Bubbles/>` component to add an area layer

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| data | ✓ | query name | Query result, referenced using curly braces. |
| lat | ✓ | column name | Column containing latitude values. |
| long | ✓ | column name | Column containing longitude values. |
| size | ✓ | column name | Column that determines the size displayed for each point. |
| sizeFmt | | format string | Format string for displaying the size value in tooltips. |
| maxSize | | number (default: 20) | Maximum size of the bubbles. |
| value | | column name | Column that determines the value displayed at each point (used for color scale). |
| valueFmt | | format string | Format string for displaying the value. |
| pointName | | column name | Column containing the names/labels of the points - by default, this is shown as the title of the tooltip. |
| paneType | | text | Specifies the type of pane where the bubbles will be rendered. |
| z | | number | Represents the z-index value for the pane, controlling its stacking order relative to other panes (higher values are on top, e.g., z=2 is above z=1). |
| ignoreZoom | | true/false (default: false) | Stops map from zooming out to show all data for this layer |

### Common Layer Options

#### Color Scale

| Property | Type | Description |
|----------|------|-------------|
| colorPalette | array of colors | Array of colors used for theming the points or areas based on data. |
| min | number (default: min of value column) | Minimum value to use for the color scale. |
| max | number (default: max of value column) | Maximum value to use for the color scale. |

#### Interactivity

| Property | Type | Description |
|----------|------|-------------|
| link | URL | URL to navigate to when a point or area is clicked. |
| name | string | Input name. Can be referenced on your page with {inputs.my_input_name}. |

#### Styling
| Property | Type | Description |
|----------|------|-------------|
| color | CSS color value | Color for the points or areas. Use when you want all points or areas to be the same color. |
| borderWidth | pixel value | Width of the border around each point or area. |
| borderColor | CSS color value | Color of the border around each point or area. |
| opacity | number between 0 and 1 | Opacity of the points or areas. |

#### Selected State
| Property | Type | Description |
|----------|------|-------------|
| selectedColor | CSS color value | When point or area is selected: Color for the points or areas. |
| selectedBorderWidth | pixel value | When point or area is selected: Width of the border around each point or area. |
| selectedBorderColor | CSS color value | When point or area is selected: Color of the border around each point or area. |
| selectedOpacity | number between 0 and 1 | When point or area is selected: Opacity of the points or areas. |

#### Tooltips
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| showTooltip | true/false | true | Whether to show tooltips. |
| tooltipType | hover/click | hover | Determines whether tooltips are activated by hover or click. |
| tooltipClass | CSS class | | CSS class applied to the tooltip content. You can pass Tailwind classes into this prop to custom-style the tooltip. |
| tooltip | array of objects | | Configuration for tooltips associated with each area. See below example for format |

#### `tooltip` example:

```javascript
tooltip="[
    {id: 'zip_code', fmt: 'id', showColumnName: false, valueClass: 'text-xl font-semibold'",
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
