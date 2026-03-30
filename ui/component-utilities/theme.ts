// @ts-expect-error ECharts CJS typings don't expose named exports cleanly, but bundling works.
import {registerTheme} from 'echarts'

// ── Color tokens ────────────────────────────────────────────────────────
// Palette C · Fjord Dusk
export const colorPalette = [
  '#3D6B7E', // deep teal    — Scandinavian twilight anchor
  '#C87F5A', // warm amber   — accent warmth, kiln-fired
  '#87A68C', // sage green   — twilight foliage
  '#8E7AA0', // muted mauve  — dusk shadow
  '#D4A94C', // amber gold   — last light on water
  '#5B8F9E', // fjord blue   — mid-tone companion
  '#C4868E', // dusty rose   — fading alpine glow
]

let clr = {
  white: '#ffffff',
  tooltipTxt: '#111827',
  textDark: '#374151',
  textMid: '#6b7280',
  textLight: '#9ca3af',
  lineSubtle: '#d1d5db',
  splitLine: '#dde0e4',
  border: '#e5e7eb',
  seqStart: '#e4eff3',
  statusBad: '#B87470', // muted brick red — in-theme with Fjord Dusk's cool desaturation
}

registerTheme('graphene-theme', {
  color: colorPalette,
  backgroundColor: clr.white,
  textStyle: {
    fontFamily: "'Source Sans 3', sans-serif",
    color: clr.textMid,
    fontSize: 13,
  },
  title: {
    left: 'left',
    textStyle: {color: clr.textDark, fontSize: 15},
  },

  categoryAxis: {
    axisLine: {lineStyle: {color: clr.border}},
    axisLabel: {color: clr.textLight},
    axisTick: {show: false},
    splitLine: {show: false, lineStyle: {color: clr.splitLine, type: 'dashed'}},
  },
  valueAxis: {
    axisLine: {show: false, lineStyle: {color: clr.border}},
    axisLabel: {
      color: clr.textLight,
      formatter: function (val) {
        if (val === 0) return '0'
        let abs = Math.abs(val)
        if (abs < 0.01) return val.toExponential(1)
        if (abs >= 1e9) return (val / 1e9).toPrecision(2).replace(/\.0$/, '') + 'B'
        if (abs >= 1e6) return (val / 1e6).toPrecision(2).replace(/\.0$/, '') + 'M'
        if (abs >= 1e3) return (val / 1e3).toPrecision(2).replace(/\.0$/, '') + 'K'
        return String(val)
      },
    },
    axisTick: {show: false},
    splitLine: {lineStyle: {color: clr.splitLine}},
    splitNumber: 3,
  },
  tooltip: {
    backgroundColor: clr.white,
    borderColor: clr.border,
    textStyle: {color: clr.tooltipTxt},
  },

  visualMap: {
    show: false,
    textStyle: {color: clr.textLight},
  },
  legend: {
    type: 'scroll',
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    top: 24,
    left: 0,
    textStyle: {color: clr.textMid},
  },
  grid: {
    top: 75,
    left: 40,
    right: 16,
    bottom: 36,
    containLabel: false,
  },
  line: {
    smooth: true,
    symbol: 'emptyCircle',
    symbolSize: 6,
    lineStyle: {width: 2},
  },
  bar: {
    itemStyle: {borderRadius: [3, 3, 0, 0]},
  },
  pie: {
    radius: ['30%', '58%'],
    label: {color: clr.textMid},
  },
  scatter: {
    symbolSize: 8,
    itemStyle: {opacity: 0.8},
  },
  radar: {
    axisName: {color: clr.textLight},
    splitLine: {lineStyle: {color: clr.border}},
    splitArea: {show: false},
    axisLine: {lineStyle: {color: clr.border}},
    areaStyle: {opacity: 0.15},
    lineStyle: {width: 1.5},
  },
  boxplot: {
    itemStyle: {
      color: clr.seqStart,
      borderColor: colorPalette[0],
      borderWidth: 1.5,
    },
  },
  candlestick: {
    itemStyle: {
      color: colorPalette[2], // up candle   — sage green
      color0: clr.statusBad, // down candle — brick red
      borderColor: colorPalette[2],
      borderColor0: clr.statusBad,
      borderWidth: 1.5,
    },
  },
  gauge: {
    progress: {show: true, width: 14, roundCap: true},
    axisLine: {roundCap: true, lineStyle: {width: 14, color: [[1, clr.border]]}},
    axisTick: {show: false},
    splitLine: {show: false},
    axisLabel: {show: false},
    pointer: {show: false},
    detail: {valueAnimation: true, fontSize: 24, color: clr.textDark, offsetCenter: [0, '0%']},
  },
  funnel: {
    left: '10%',
    width: '80%',
    label: {position: 'inside', color: clr.white, fontSize: 12},
    itemStyle: {borderColor: clr.white, borderWidth: 1},
  },
  heatmap: {
    label: {show: true, color: clr.textDark, fontSize: 11},
  },
  graph: {
    lineStyle: {color: clr.lineSubtle, width: 1.5, opacity: 1},
    label: {show: true, color: clr.textDark, fontSize: 11, position: 'right'},
  },
  tree: {
    orient: 'LR',
    symbolSize: 10,
    lineStyle: {color: colorPalette[0], width: 2},
    itemStyle: {color: colorPalette[0], borderColor: colorPalette[0]},
    label: {color: clr.textDark, fontSize: 11, position: 'top', verticalAlign: 'middle', align: 'center'},
    leaves: {label: {position: 'right', verticalAlign: 'middle', align: 'left'}},
    emphasis: {focus: 'descendant'},
  },
  treemap: {
    roam: false,
    breadcrumb: {show: false},
    label: {color: clr.white, fontSize: 12},
    itemStyle: {borderColor: clr.white, borderWidth: 0, gapWidth: 1},
  },
  sunburst: {
    label: {color: clr.textDark, fontSize: 10, rotateLabel: true},
    itemStyle: {borderColor: clr.white, borderWidth: 1},
  },
  sankey: {
    nodeWidth: 8,
    nodeGap: 12,
    lineStyle: {color: 'gradient', opacity: 0.3},
    label: {color: clr.textDark, fontSize: 11},
  },
})
