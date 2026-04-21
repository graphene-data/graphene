<script lang="ts">
  import ECharts from '../components/ECharts.svelte'

  let monthRows = [
    {month: '2024-01-01', value: 0.082},
    {month: '2024-02-01', value: 0.0932},
    {month: '2024-03-01', value: 0.0901},
    {month: '2024-04-01', value: 0.129},
    {month: '2024-05-01', value: 0.133},
    {month: '2024-06-01', value: 0.152},
  ]

  let weekdaySeriesRows = [
    {day_of_week: 1, metric: 'Downloads', value: 150},
    {day_of_week: 2, metric: 'Downloads', value: 230},
    {day_of_week: 3, metric: 'Downloads', value: 224},
    {day_of_week: 4, metric: 'Downloads', value: 218},
    {day_of_week: 5, metric: 'Downloads', value: 335},
    {day_of_week: 6, metric: 'Downloads', value: 410},
    {day_of_week: 7, metric: 'Downloads', value: 360},
    {day_of_week: 1, metric: 'Installs', value: 80},
    {day_of_week: 2, metric: 'Installs', value: 120},
    {day_of_week: 3, metric: 'Installs', value: 150},
    {day_of_week: 4, metric: 'Installs', value: 130},
    {day_of_week: 5, metric: 'Installs', value: 210},
    {day_of_week: 6, metric: 'Installs', value: 280},
    {day_of_week: 7, metric: 'Installs', value: 220},
  ]

  let quarterMetricRows = [
    {quarter_of_year: 1, metric: 'Revenue', value: 42},
    {quarter_of_year: 2, metric: 'Revenue', value: 51},
    {quarter_of_year: 3, metric: 'Revenue', value: 48},
    {quarter_of_year: 4, metric: 'Revenue', value: 67},
    {quarter_of_year: 1, metric: 'Cost', value: 28},
    {quarter_of_year: 2, metric: 'Cost', value: 32},
    {quarter_of_year: 3, metric: 'Cost', value: 30},
    {quarter_of_year: 4, metric: 'Cost', value: 38},
  ]

  let hourOrdinalRows = [
    {hour_of_day: 22, volume: 120},
    {hour_of_day: 7, volume: 95},
    {hour_of_day: 14, volume: 143},
    {hour_of_day: 3, volume: 60},
    {hour_of_day: 19, volume: 158},
    {hour_of_day: 10, volume: 112},
  ]


  let scatterRows = [
    {group: 'Group A', x: 10, y: 8},
    {group: 'Group A', x: 20, y: 35},
    {group: 'Group A', x: 30, y: 22},
    {group: 'Group A', x: 40, y: 60},
    {group: 'Group A', x: 50, y: 55},
    {group: 'Group A', x: 60, y: 80},
    {group: 'Group A', x: 70, y: 75},
    {group: 'Group B', x: 15, y: 5},
    {group: 'Group B', x: 25, y: 18},
    {group: 'Group B', x: 35, y: 30},
    {group: 'Group B', x: 45, y: 40},
    {group: 'Group B', x: 55, y: 35},
    {group: 'Group B', x: 65, y: 50},
    {group: 'Group B', x: 75, y: 60},
  ]


  let pieRows = [
    {channel: 'Organic', value: 335},
    {channel: 'Paid', value: 310},
    {channel: 'Referral', value: 234},
    {channel: 'Social', value: 135},
  ]

  let heatmapRows = [
    {day: 'Mon', period: 'Morning', value: 28},
    {day: 'Tue', period: 'Morning', value: 33},
    {day: 'Wed', period: 'Morning', value: 47},
    {day: 'Thu', period: 'Morning', value: 40},
    {day: 'Fri', period: 'Morning', value: 38},
    {day: 'Sat', period: 'Morning', value: 25},
    {day: 'Sun', period: 'Morning', value: 18},
    {day: 'Mon', period: 'Evening', value: 66},
    {day: 'Tue', period: 'Evening', value: 72},
    {day: 'Wed', period: 'Evening', value: 81},
    {day: 'Thu', period: 'Evening', value: 75},
    {day: 'Fri', period: 'Evening', value: 69},
    {day: 'Sat', period: 'Evening', value: 55},
    {day: 'Sun', period: 'Evening', value: 44},
  ]

  let candleRows = [
    {month: 'Jan', open: 20, close: 34, low: 10, high: 38},
    {month: 'Feb', open: 40, close: 35, low: 30, high: 50},
    {month: 'Mar', open: 31, close: 38, low: 33, high: 44},
    {month: 'Apr', open: 38, close: 15, low: 5, high: 42},
    {month: 'May', open: 12, close: 36, low: 10, high: 40},
    {month: 'Jun', open: 27, close: 45, low: 25, high: 48},
    {month: 'Jul', open: 38, close: 52, low: 35, high: 56},
    {month: 'Aug', open: 49, close: 60, low: 45, high: 65},
  ]

  let funnelRows = [
    {stage: 'Visited', value: 100},
    {stage: 'Inquiry', value: 80},
    {stage: 'Order', value: 60},
    {stage: 'Payment', value: 40},
    {stage: 'Complete', value: 20},
  ]

  let treemapRows = [
    {name: 'Storage', value: 40},
    {name: 'Compute', value: 30},
    {name: 'Network', value: 20},
    {name: 'Database', value: 15},
    {name: 'Security', value: 10},
    {name: 'CDN', value: 8},
  ]

  let themeRiverRows = [
    {month: '2024-01-01', topic: 'JS', value: 10},
    {month: '2024-02-01', topic: 'JS', value: 15},
    {month: '2024-03-01', topic: 'JS', value: 20},
    {month: '2024-04-01', topic: 'JS', value: 18},
    {month: '2024-05-01', topic: 'JS', value: 25},
    {month: '2024-06-01', topic: 'JS', value: 30},
    {month: '2024-01-01', topic: 'Python', value: 8},
    {month: '2024-02-01', topic: 'Python', value: 12},
    {month: '2024-03-01', topic: 'Python', value: 18},
    {month: '2024-04-01', topic: 'Python', value: 22},
    {month: '2024-05-01', topic: 'Python', value: 20},
    {month: '2024-06-01', topic: 'Python', value: 25},
  ]

  let groupedStackedRows = [
    {quarter: 'Q1', region: 'North', channel: 'Online', value: 160},
    {quarter: 'Q1', region: 'North', channel: 'Retail', value: 110},
    {quarter: 'Q1', region: 'South', channel: 'Online', value: 130},
    {quarter: 'Q1', region: 'South', channel: 'Retail', value: 95},
    {quarter: 'Q2', region: 'North', channel: 'Online', value: 175},
    {quarter: 'Q2', region: 'North', channel: 'Retail', value: 120},
    {quarter: 'Q2', region: 'South', channel: 'Online', value: 145},
    {quarter: 'Q2', region: 'South', channel: 'Retail', value: 105},
    {quarter: 'Q3', region: 'North', channel: 'Online', value: 190},
    {quarter: 'Q3', region: 'North', channel: 'Retail', value: 125},
    {quarter: 'Q3', region: 'South', channel: 'Online', value: 155},
    {quarter: 'Q3', region: 'South', channel: 'Retail', value: 115},
  ]
  let groupedStackedSlots = Array.from(new Set(groupedStackedRows.map(row => `${row.quarter}|${row.region}`)))
  let groupedStackedRegionLabels = groupedStackedSlots.map(slot => slot.split('|')[1])
  let groupedStackedQuarterLabels = groupedStackedSlots.map((slot, index, slots) => {
    let quarter = slot.split('|')[0]
    let previousQuarter = slots[index - 1]?.split('|')[0]
    return quarter === previousQuarter ? '' : quarter
  })
  let groupedStackedSlotRows = groupedStackedRows.map(row => ({
    ...row,
    slot: groupedStackedSlots.indexOf(`${row.quarter}|${row.region}`),
  }))

  let dualAxisRows = [
    {month: '2024-01-01', revenue: 120, conversion_rate: 3.2},
    {month: '2024-02-01', revenue: 138, conversion_rate: 3.5},
    {month: '2024-03-01', revenue: 150, conversion_rate: 3.9},
    {month: '2024-04-01', revenue: 166, conversion_rate: 4.1},
    {month: '2024-05-01', revenue: 184, conversion_rate: 4.4},
    {month: '2024-06-01', revenue: 205, conversion_rate: 4.8},
  ]

  let bubbleRows = [
    {segment: 'SMB', efficiency: 42, growth: 28, pipeline: 120, quality: 55},
    {segment: 'Mid Market', efficiency: 58, growth: 35, pipeline: 180, quality: 62},
    {segment: 'Enterprise', efficiency: 66, growth: 48, pipeline: 260, quality: 70},
    {segment: 'Public Sector', efficiency: 51, growth: 31, pipeline: 150, quality: 58},
    {segment: 'Healthcare', efficiency: 63, growth: 44, pipeline: 220, quality: 68},
    {segment: 'Retail', efficiency: 47, growth: 30, pipeline: 140, quality: 53},
  ]

  let sankeyRows = [
    {source: 'Leads', target: 'Qualified', value: 420},
    {source: 'Leads', target: 'Disqualified', value: 180},
    {source: 'Qualified', target: 'Demo', value: 260},
    {source: 'Qualified', target: 'No Decision', value: 160},
    {source: 'Demo', target: 'Proposal', value: 190},
    {source: 'Proposal', target: 'Won', value: 130},
    {source: 'Proposal', target: 'Lost', value: 60},
  ]

  let chordRows = [
    {source: 'Design', target: 'Engineering', value: 30},
    {source: 'Design', target: 'Marketing', value: 12},
    {source: 'Engineering', target: 'Support', value: 18},
    {source: 'Engineering', target: 'Marketing', value: 8},
    {source: 'Marketing', target: 'Sales', value: 24},
    {source: 'Sales', target: 'Support', value: 16},
    {source: 'Support', target: 'Design', value: 6},
  ]

  let beeswarmRows: {group: string; value: number}[] = []
  for (let group of ['SMB', 'Mid Market', 'Enterprise', 'Public Sector']) {
    for (let i = 0; i < 30; i++) beeswarmRows.push({group, value: Math.round(50 + (Math.random() - 0.5) * 40)})
  }

  let dayPeriods = ['Morning', 'Evening']
  let weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
</script>

<div class="chart-grid">
  <ECharts
    data={{
      rows: monthRows,
      fields: [
        {name: 'month', type: 'date', metadata: {timeGrain: 'month'}},
        {name: 'value', type: 'number', metadata: {ratio: true}},
      ],
    }}
    config={{
      title: {text: 'Line (Percentage Metadata)'},
      series: [{type: 'line', encode: {x: 'month', y: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: weekdaySeriesRows,
      fields: [
        {name: 'day_of_week', type: 'number', metadata: {timeOrdinal: 'dow_1m'}},
        {name: 'metric', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Stacked Area'},
      series: [{type: 'line', stack: 'total', areaStyle: {}, encode: {x: 'day_of_week', y: 'value', splitBy: 'metric'}}],
    }}
  />

  <ECharts
    data={{
      rows: quarterMetricRows,
      fields: [
        {name: 'quarter_of_year', type: 'number', metadata: {timeOrdinal: 'quarter_of_year'}},
        {name: 'metric', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Bar (Quarter Ordinal)'},
      series: [{type: 'bar', encode: {x: 'quarter_of_year', y: 'value', splitBy: 'metric'}}],
    }}
  />

  <ECharts
    data={{
      rows: hourOrdinalRows,
      fields: [
        {name: 'hour_of_day', type: 'number', metadata: {timeOrdinal: 'hour_of_day'}},
        {name: 'volume', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Line (Hour Ordinal)'},
      series: [{type: 'line', encode: {x: 'hour_of_day', y: 'volume'}}],
    }}
  />


  <ECharts
    data={{
      rows: scatterRows,
      fields: [
        {name: 'group', type: 'string'},
        {name: 'x', type: 'number'},
        {name: 'y', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Scatter'},
      series: [{type: 'scatter', encode: {x: 'x', y: 'y', splitBy: 'group'}}],
    }}
  />

  <ECharts
    data={{
      rows: groupedStackedSlotRows,
      fields: [
        {name: 'quarter', type: 'string'},
        {name: 'region', type: 'string'},
        {name: 'channel', type: 'string'},
        {name: 'value', type: 'number'},
        {name: 'slot', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Grouped + Stacked Bar (Two X-Axes)'},
      tooltip: {trigger: 'axis'},
      legend: {show: true},
      grid: {bottom: 56},
      xAxis: [
        {type: 'category', data: groupedStackedRegionLabels, axisTick: {alignWithLabel: true}},
        {type: 'category', data: groupedStackedQuarterLabels, position: 'bottom', offset: 24, axisTick: {show: false}},
      ],
      yAxis: {type: 'value'},
      series: [{type: 'bar', stack: 'channels', encode: {x: 'slot', y: 'value', splitBy: 'channel'}}],
    }}
  />

  <ECharts
    data={{
      rows: pieRows,
      fields: [
        {name: 'channel', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Pie'},
      tooltip: {trigger: 'item'},
      series: [{type: 'pie', encode: {itemName: 'channel', value: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: heatmapRows,
      fields: [
        {name: 'day', type: 'string'},
        {name: 'period', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Heatmap'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'category', data: weekDays},
      yAxis: {type: 'category', data: dayPeriods},
      visualMap: {min: 0, max: 100, show: false},
      series: [{type: 'heatmap', encode: {x: 'day', y: 'period', value: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: candleRows,
      fields: [
        {name: 'month', type: 'string'},
        {name: 'open', type: 'number'},
        {name: 'close', type: 'number'},
        {name: 'low', type: 'number'},
        {name: 'high', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Candlestick'},
      tooltip: {trigger: 'axis'},
      xAxis: {type: 'category'},
      yAxis: {type: 'value', scale: true},
      series: [{type: 'candlestick', encode: {x: 'month', y: ['open', 'close', 'low', 'high']}}],
    }}
  />

  <ECharts
    data={{
      rows: funnelRows,
      fields: [
        {name: 'stage', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Funnel'},
      tooltip: {trigger: 'item'},
      series: [{type: 'funnel', encode: {itemName: 'stage', value: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: treemapRows,
      fields: [
        {name: 'name', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Treemap'},
      tooltip: {trigger: 'item'},
      series: [{type: 'treemap', encode: {itemName: 'name', value: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: themeRiverRows,
      fields: [
        {name: 'month', type: 'date'},
        {name: 'topic', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Theme River'},
      tooltip: {trigger: 'axis'},
      singleAxis: {type: 'time'},
      series: [{type: 'themeRiver', encode: {single: 'month', value: 'value', seriesName: 'topic', splitBy: 'topic'}}],
    }}
  />

  <ECharts
    data={{
      rows: dualAxisRows,
      fields: [
        {name: 'month', type: 'date'},
        {name: 'revenue', type: 'number'},
        {name: 'conversion_rate', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Bar + Line (Dual Axis)'},
      tooltip: {trigger: 'axis'},
      legend: {},
      xAxis: {type: 'time'},
      yAxis: [
        {type: 'value', name: 'Revenue'},
        {type: 'value', name: 'Conversion %'},
      ],
      series: [
        {name: 'Revenue', type: 'bar', encode: {x: 'month', y: 'revenue'}},
        {name: 'Conversion %', type: 'line', yAxisIndex: 1, smooth: true, encode: {x: 'month', y: 'conversion_rate'}},
      ],
    }}
  />

  <ECharts
    data={{
      rows: bubbleRows,
      fields: [
        {name: 'segment', type: 'string'},
        {name: 'efficiency', type: 'number'},
        {name: 'growth', type: 'number'},
        {name: 'pipeline', type: 'number'},
        {name: 'quality', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Bubble (x/y/size/color)'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'value', name: 'Efficiency'},
      yAxis: {type: 'value', name: 'Growth'},
      visualMap: [
        {dimension: 'quality', min: 50, max: 72, inRange: {color: ['#60a5fa', '#2563eb', '#1e3a8a']}, show: false},
        {dimension: 'pipeline', min: 100, max: 280, inRange: {symbolSize: [10, 28]}, show: false},
      ],
      series: [{type: 'scatter', encode: {x: 'efficiency', y: 'growth', tooltip: ['segment', 'pipeline', 'quality']}}],
    }}
  />

  <ECharts
    data={{
      rows: beeswarmRows,
      fields: [
        {name: 'group', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Beeswarm'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'category', jitter: 40, jitterOverlap: false},
      yAxis: {type: 'value'},
      series: [{type: 'scatter', symbolSize: 8, encode: {x: 'group', y: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: chordRows,
      fields: [
        {name: 'source', type: 'string'},
        {name: 'target', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Chord'},
      tooltip: {trigger: 'item'},
      series: [{type: 'chord', encode: {source: 'source', target: 'target', value: 'value'}}],
    }}
  />

  <ECharts
    data={{
      rows: sankeyRows,
      fields: [
        {name: 'source', type: 'string'},
        {name: 'target', type: 'string'},
        {name: 'value', type: 'number'},
      ],
    }}
    config={{
      title: {text: 'Sankey'},
      tooltip: {trigger: 'item'},
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: {focus: 'adjacency'},
        encode: {source: 'source', target: 'target', value: 'value'},
        lineStyle: {curveness: 0.5},
      }],
    }}
  />
</div>

<style>
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 16px;
  }

  :global(.chart-grid .echarts-container) {
    margin: 0;
  }
</style>
