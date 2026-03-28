<script lang="ts">
  import ECharts2 from '../components2/ECharts2.svelte'

  let monthRows = [
    {month: '2024-01-01', value: 820},
    {month: '2024-02-01', value: 932},
    {month: '2024-03-01', value: 901},
    {month: '2024-04-01', value: 1290},
    {month: '2024-05-01', value: 1330},
    {month: '2024-06-01', value: 1520},
  ]

  let weekdaySeriesRows = [
    {day: 'Mon', metric: 'Downloads', value: 150},
    {day: 'Tue', metric: 'Downloads', value: 230},
    {day: 'Wed', metric: 'Downloads', value: 224},
    {day: 'Thu', metric: 'Downloads', value: 218},
    {day: 'Fri', metric: 'Downloads', value: 335},
    {day: 'Sat', metric: 'Downloads', value: 410},
    {day: 'Sun', metric: 'Downloads', value: 360},
    {day: 'Mon', metric: 'Installs', value: 80},
    {day: 'Tue', metric: 'Installs', value: 120},
    {day: 'Wed', metric: 'Installs', value: 150},
    {day: 'Thu', metric: 'Installs', value: 130},
    {day: 'Fri', metric: 'Installs', value: 210},
    {day: 'Sat', metric: 'Installs', value: 280},
    {day: 'Sun', metric: 'Installs', value: 220},
  ]

  let quarterRows = [
    {quarter: 'Q1', metric: 'Revenue', value: 42000},
    {quarter: 'Q2', metric: 'Revenue', value: 51000},
    {quarter: 'Q3', metric: 'Revenue', value: 48000},
    {quarter: 'Q4', metric: 'Revenue', value: 67000},
    {quarter: 'Q1', metric: 'Cost', value: 28000},
    {quarter: 'Q2', metric: 'Cost', value: 32000},
    {quarter: 'Q3', metric: 'Cost', value: 30000},
    {quarter: 'Q4', metric: 'Cost', value: 38000},
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
  let groupedStackedChannelValues = (channel: string) => {
    return groupedStackedSlots.map(slot => {
      let [quarter, region] = slot.split('|')
      return groupedStackedRows.find(row => row.quarter === quarter && row.region === region && row.channel === channel)?.value ?? 0
    })
  }

  let dualAxisRows = [
    {month: 'Jan', revenue: 120, conversion_rate: 3.2},
    {month: 'Feb', revenue: 138, conversion_rate: 3.5},
    {month: 'Mar', revenue: 150, conversion_rate: 3.9},
    {month: 'Apr', revenue: 166, conversion_rate: 4.1},
    {month: 'May', revenue: 184, conversion_rate: 4.4},
    {month: 'Jun', revenue: 205, conversion_rate: 4.8},
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

  let twoColFields = [
    {name: 'month', evidenceType: 'date'},
    {name: 'value', evidenceType: 'number'},
  ]

  let weekdayFields = [
    {name: 'day', evidenceType: 'string'},
    {name: 'metric', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]

  let quarterFields = [
    {name: 'quarter', evidenceType: 'string'},
    {name: 'metric', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]

  let scatterFields = [
    {name: 'group', evidenceType: 'string'},
    {name: 'x', evidenceType: 'number'},
    {name: 'y', evidenceType: 'number'},
  ]

  let labelValueFields = [
    {name: 'channel', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]

  let groupedStackedFields = [
    {name: 'quarter', evidenceType: 'string'},
    {name: 'region', evidenceType: 'string'},
    {name: 'channel', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]

  let dualAxisFields = [
    {name: 'month', evidenceType: 'string'},
    {name: 'revenue', evidenceType: 'number'},
    {name: 'conversion_rate', evidenceType: 'number'},
  ]

  let bubbleFields = [
    {name: 'segment', evidenceType: 'string'},
    {name: 'efficiency', evidenceType: 'number'},
    {name: 'growth', evidenceType: 'number'},
    {name: 'pipeline', evidenceType: 'number'},
    {name: 'quality', evidenceType: 'number'},
  ]

  let sankeyFields = [
    {name: 'source', evidenceType: 'string'},
    {name: 'target', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]

  let sankeyNodes = Array.from(new Set(sankeyRows.flatMap(row => [row.source, row.target]))).map(name => ({name}))
  let qualityColor = (quality: number) => quality >= 68 ? '#1e3a8a' : quality >= 60 ? '#2563eb' : '#60a5fa'

  let dayPeriods = ['Morning', 'Evening']
  let weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
</script>

<div class="chart-grid">
  <ECharts2
    height={320}
    data={{rows: monthRows, fields: twoColFields}}
    config={{
      title: {text: 'Line'},
      tooltip: {trigger: 'axis'},
      xAxis: {type: 'time'},
      yAxis: {type: 'value'},
      series: [{type: 'line', encode: {x: 'month', y: 'value'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: weekdaySeriesRows, fields: weekdayFields}}
    config={{
      title: {text: 'Stacked Area'},
      tooltip: {trigger: 'axis'},
      xAxis: {type: 'category'},
      yAxis: {type: 'value'},
      series: [{type: 'line', stack: 'total', areaStyle: {}, encode: {x: 'day', y: 'value', group: 'metric'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: quarterRows, fields: quarterFields}}
    config={{
      title: {text: 'Bar'},
      tooltip: {trigger: 'axis'},
      xAxis: {type: 'category'},
      yAxis: {type: 'value'},
      series: [{type: 'bar', encode: {x: 'quarter', y: 'value', group: 'metric'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: scatterRows, fields: scatterFields}}
    config={{
      title: {text: 'Scatter'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'value'},
      yAxis: {type: 'value'},
      series: [{type: 'scatter', encode: {x: 'x', y: 'y', group: 'group'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: groupedStackedRows, fields: groupedStackedFields}}
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
      series: [
        {name: 'Online', type: 'bar', stack: 'channels', data: groupedStackedChannelValues('Online')},
        {name: 'Retail', type: 'bar', stack: 'channels', data: groupedStackedChannelValues('Retail')},
      ],
    }}
  />

  <!-- Non-cartesian examples still use the same column-reference mapping. -->
  <ECharts2
    height={320}
    data={{rows: pieRows, fields: labelValueFields}}
    config={{
      title: {text: 'Pie'},
      tooltip: {trigger: 'item'},
      series: [{type: 'pie', encode: {itemName: 'channel', value: 'value'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: heatmapRows, fields: [{name: 'day', evidenceType: 'string'}, {name: 'period', evidenceType: 'string'}, {name: 'value', evidenceType: 'number'}]}}
    config={{
      title: {text: 'Heatmap'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'category', data: weekDays},
      yAxis: {type: 'category', data: dayPeriods},
      visualMap: {min: 0, max: 100, show: false},
      series: [{
        type: 'heatmap',
        data: heatmapRows.map(row => [weekDays.indexOf(row.day), dayPeriods.indexOf(row.period), row.value]),
      }],
    }}
  />

  <ECharts2
    height={320}
    data={{
      rows: candleRows,
      fields: [
        {name: 'month', evidenceType: 'string'},
        {name: 'open', evidenceType: 'number'},
        {name: 'close', evidenceType: 'number'},
        {name: 'low', evidenceType: 'number'},
        {name: 'high', evidenceType: 'number'},
      ],
    }}
    config={{
      title: {text: 'Candlestick'},
      tooltip: {trigger: 'axis'},
      xAxis: {type: 'category', data: candleRows.map(row => row.month)},
      yAxis: {type: 'value', scale: true},
      series: [{type: 'candlestick', data: candleRows.map(row => [row.open, row.close, row.low, row.high])}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: funnelRows, fields: [{name: 'stage', evidenceType: 'string'}, {name: 'value', evidenceType: 'number'}]}}
    config={{
      title: {text: 'Funnel'},
      tooltip: {trigger: 'item'},
      series: [{type: 'funnel', encode: {itemName: 'stage', value: 'value'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: treemapRows, fields: [{name: 'name', evidenceType: 'string'}, {name: 'value', evidenceType: 'number'}]}}
    config={{
      title: {text: 'Treemap'},
      tooltip: {trigger: 'item'},
      series: [{type: 'treemap', encode: {itemName: 'name', value: 'value'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{
      rows: themeRiverRows,
      fields: [
        {name: 'month', evidenceType: 'date'},
        {name: 'topic', evidenceType: 'string'},
        {name: 'value', evidenceType: 'number'},
      ],
    }}
    config={{
      title: {text: 'Theme River'},
      tooltip: {trigger: 'axis'},
      singleAxis: {type: 'time'},
      series: [{type: 'themeRiver', encode: {single: 'month', value: 'value', seriesName: 'topic', group: 'topic'}}],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: dualAxisRows, fields: dualAxisFields}}
    config={{
      title: {text: 'Bar + Line (Dual Axis)'},
      tooltip: {trigger: 'axis'},
      legend: {},
      xAxis: {type: 'category', data: dualAxisRows.map(row => row.month)},
      yAxis: [
        {type: 'value', name: 'Revenue'},
        {type: 'value', name: 'Conversion %'},
      ],
      series: [
        {name: 'Revenue', type: 'bar', data: dualAxisRows.map(row => row.revenue)},
        {name: 'Conversion %', type: 'line', yAxisIndex: 1, smooth: true, data: dualAxisRows.map(row => row.conversion_rate)},
      ],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: bubbleRows, fields: bubbleFields}}
    config={{
      title: {text: 'Bubble (x/y/size/color)'},
      tooltip: {trigger: 'item'},
      xAxis: {type: 'value', name: 'Efficiency'},
      yAxis: {type: 'value', name: 'Growth'},
      series: [{
        type: 'scatter',
        data: bubbleRows.map(row => ({
          name: row.segment,
          value: [row.efficiency, row.growth],
          symbolSize: Math.sqrt(row.pipeline) * 1.8,
          itemStyle: {color: qualityColor(row.quality)},
        })),
      }],
    }}
  />

  <ECharts2
    height={320}
    data={{rows: sankeyRows, fields: sankeyFields}}
    config={{
      title: {text: 'Sankey'},
      tooltip: {trigger: 'item'},
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: {focus: 'adjacency'},
        data: sankeyNodes,
        links: sankeyRows,
        lineStyle: {curveness: 0.5},
      }],
    }}
  />
</div>

<style>
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 16px;
  }

  :global(.chart-grid .echarts2-container) {
    margin: 0;
  }
</style>
