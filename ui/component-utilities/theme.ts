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

// Rotate a palette by a deterministic page offset so pages don't always start on the same color.
// We keep this pure and reusable so enrichments can apply it onto config.color.
export function paletteForPath(pathname?: string) {
  if (import.meta.env.VITE_TEST) return [...colorPalette] // Keep screenshot baselines stable in UI tests.

  let rawPath = pathname ?? location.pathname
  let key = String(rawPath)
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
  key = key.replace(/\/index$/i, '') || 'index'

  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  let offset = (hash >>> 0) % colorPalette.length
  if (offset === 0) return [...colorPalette]
  return [...colorPalette.slice(offset), ...colorPalette.slice(0, offset)]
}

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

let axisCommon = {
  axisLine: {lineStyle: {color: clr.border}},
  axisLabel: {color: clr.textLight},
  axisTick: {show: false},
  splitLine: {show: false, lineStyle: {color: clr.splitLine, type: 'dashed'}},
}

registerTheme('graphene-theme', {
  color: colorPalette,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: "'Source Sans 3', sans-serif",
    color: clr.textMid,
    fontSize: 13,
  },
  title: {
    left: 'left',
    padding: 0,
    textStyle: {color: clr.textDark, fontSize: 15},
  },
  categoryAxis: {
    ...axisCommon,
  },
  valueAxis: {
    ...axisCommon,
    splitLine: {lineStyle: {color: clr.splitLine}},
    splitNumber: 3,
  },
  timeAxis: {
    ...axisCommon,
  },
  logAxis: {
    ...axisCommon,
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
    smooth: false,
    symbol: 'emptyCircle',
    symbolSize: 6,
    lineStyle: {width: 2},
  },
  bar: {},
  pie: {
    radius: ['30%', '58%'],
    label: {color: clr.textMid},
    itemStyle: {borderColor: 'var(--color-bg)', borderWidth: 1},
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
