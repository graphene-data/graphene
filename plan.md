# Viz rewrite v1 plan

Build a clean replacement for the current Evidence-derived viz layer, starting with a single new implementation we can evaluate before expanding.

We're going to start building our new viz in parallel with the old, suffixing all new components with 2, so BarChart2.

Our new design is centered around echarts configs. You pass a config to our ECharts2 component, and it renders that config.

Components like BarChart2 are thin convenience APIs around the most common cases. They don't have the same api as the old version of these components, they support far fewer attributes, and really just designed for the common happy-path. Any user who whats to do something these don't support can just use <ECharts2> directly, and because of enrichments they'll still get a nice chart without having to set every property.

Our new api also does not use the _evidenceColumnTypes of the previous approach. ECharts now takes in a `fields` array that describes all the fields and their types in the data.

Most of the logic in trying to make a chart look good is going to move into enrich.ts. Enrichments are small, single-purpose functions that improve the defaults of the config one by one.

We use echarts `dataset` and `encode`. For the most part, we want to keep the echarts config exactly the same. The biggest difference is that we allow you to pass in `series[0].series` as a string, and we'll automatically create all the needed series for you. This is done in `expandSeriesTransforms`.

This new viz layer is a fresh rethinking of the API, so in general don't add code for backwards compatibility unless asked to.

You can also pass echarts config via markdown, like this:
```
<ECharts2 data="some_table">
  title: {text: "foo"},
  series: [{type: "bar", encode: {x: "month", y: "value"}],
</ECharts2>
```
The contents here are automatically json5 parsed.

## Dev and testing

We're going to put all the tests for this in viz.test.ts. We've converted the existing tests to point at the new components, but we'll want to add more to cover the full range of what charts can do.

Each test will usually be fairly thin, just the chart's config and a line to capture a screenshot. Avoid adding lines to explicitly check chart props or results if they'd also show up in a screenshot.

Because data viz is so visual, when you think you're done with a task it's worth looking at the snapshot image to make sure it looks good and how you expect.
