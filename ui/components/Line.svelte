<script context="module">
	export const evidenceInclude = true;
</script>

<script>
	import { beforeUpdate, getContext } from 'svelte';
	import { propKey, configKey } from '@evidence-dev/component-utilities/chartContext';
	import getSeriesConfig from '@evidence-dev/component-utilities/getSeriesConfig';
	import formatTitle from '@evidence-dev/component-utilities/formatTitle';
	import getCompletedData from '@evidence-dev/component-utilities/getCompletedData';
	import getYAxisIndex from '@evidence-dev/component-utilities/getYAxisIndex';
	import {
		formatValue,
		getFormatObjectFromString
	} from '@evidence-dev/component-utilities/formatting';
	import { getThemeStores } from './themeStores';
	import { toBoolean } from './utils';

	const { resolveColor } = getThemeStores();
	const props = getContext(propKey);
	const config = getContext(configKey);

	export let y = undefined;
	const ySet = !!y;
	export let y2 = undefined;
	const y2Set = !!y2;
	export let series = undefined;
	const seriesSet = !!series;
	export let options = undefined;
	export let name = undefined;

	export let lineColor = undefined;
	$: lineColorStore = resolveColor(lineColor);

	export let lineWidth = 2;
	export let lineType = 'solid';
	export let lineOpacity = undefined;

	export let markers = false;
	$: markers = toBoolean(markers);
	export let markerShape = 'circle';
	export let markerSize = 8;

	export let labels = false;
	$: labels = toBoolean(labels);
	export let labelSize = 11;
	export let labelPosition = 'top';

	export let labelColor = undefined;
	$: labelColorStore = resolveColor(labelColor);

	export let labelFmt = undefined;
	export let yLabelFmt = undefined;
	export let y2LabelFmt = undefined;
	export let showAllLabels = false;
	$: showAllLabels = toBoolean(showAllLabels);

	export let y2SeriesType = undefined;
	export let handleMissing = 'gap';
	export let step = false;
	$: step = toBoolean(step);
	export let stepPosition = 'end';
	export let seriesOrder = undefined;
	export let seriesLabelFmt = undefined;

	let data;
	let x;
	let swapXY;
	let yFormat;
	let y2Format;
	let yCount;
	let y2Count;
	let xType;
	let xMismatch;
	let columnSummary;
	let resolvedY;
	let resolvedY2;
	let labelFormat;
	let yLabelFormat;
	let y2LabelFormat;
	let defaultLabelPosition;
	let chartOverrides;
	let seriesConfig;

	if (labelFmt) labelFormat = getFormatObjectFromString(labelFmt);
	if (yLabelFmt) yLabelFormat = getFormatObjectFromString(yLabelFmt);
	if (y2LabelFmt) y2LabelFormat = getFormatObjectFromString(y2LabelFmt);

	$: data = $props.data;
	$: x = $props.x;
	$: swapXY = $props.swapXY;
	$: yFormat = $props.yFormat;
	$: y2Format = $props.y2Format;
	$: yCount = $props.yCount;
	$: y2Count = $props.y2Count;
	$: xType = $props.xType;
	$: xMismatch = $props.xMismatch;
	$: columnSummary = $props.columnSummary;
	$: series = seriesSet ? series : $props.series;
	$: resolvedY = ySet ? y : $props.y;
	$: resolvedY2 = y2Set ? y2 : $props.y2;

	$: {
		if (!series && typeof resolvedY !== 'object') {
			if (columnSummary?.[resolvedY]) name = name ?? formatTitle(resolvedY, columnSummary[resolvedY].title);
		} else {
			try {
				data = getCompletedData(data, x, resolvedY, series);
			} catch (error) {
				globalThis.console?.warn('Failed to complete data', { error });
				data = [];
			}
		}
	}

	$: if (handleMissing === 'zero') {
		try {
			data = getCompletedData(data, x, resolvedY, series, true);
		} catch (error) {
			globalThis.console?.warn('Failed to complete data', { error });
			data = [];
		}
	}

	const labelPositions = { above: 'top', below: 'bottom', middle: 'inside' };
	const swapXYLabelPositions = { above: 'right', below: 'left', middle: 'inside' };

	$: {
		defaultLabelPosition = swapXY ? 'right' : 'top';
		labelPosition = (swapXY ? swapXYLabelPositions[labelPosition] : labelPositions[labelPosition]) ?? defaultLabelPosition;
	}

	$: baseConfig = {
		type: 'line',
		label: {
			show: labels,
			formatter: (params) =>
				params.value[swapXY ? 0 : 1] === 0
					? ''
					: formatValue(
							params.value[swapXY ? 0 : 1],
							[yLabelFormat ?? labelFormat ?? yFormat, y2LabelFormat ?? labelFormat ?? y2Format][
								getYAxisIndex(params.componentIndex, yCount, y2Count)
							]
						),
			fontSize: labelSize,
			color: $labelColorStore,
			position: labelPosition,
			padding: 3
		},
		labelLayout: { hideOverlap: showAllLabels ? false : true },
		connectNulls: handleMissing === 'connect',
		emphasis: {
			focus: 'series',
			endLabel: { show: false },
			lineStyle: { opacity: 1, width: 3 }
		},
		lineStyle: { width: parseInt(lineWidth), type: lineType, opacity: lineOpacity },
		itemStyle: { color: $lineColorStore, opacity: lineOpacity },
		showSymbol: labels || markers,
		symbol: markerShape,
		symbolSize: labels && !markers ? 0 : markerSize,
		step: step ? stepPosition : false
	};

	$: seriesConfig = getSeriesConfig(
		data,
		x,
		resolvedY,
		series,
		swapXY,
		baseConfig,
		name,
		xMismatch,
		columnSummary,
		seriesOrder,
		undefined,
		undefined,
		resolvedY2,
		seriesLabelFmt
	);

	$: config.update((value) => {
		value.series.push(...seriesConfig);
		value.legend.data.push(...seriesConfig.map((entry) => entry.name.toString()));
		return value;
	});

	$: if (options) config.update((value) => ({ ...value, ...options }));

	$: chartOverrides = {
		yAxis: { boundaryGap: ['0%', '1%'] },
		xAxis: { boundaryGap: [xType === 'time' ? '2%' : '0%', '2%'] }
	};

	beforeUpdate(() => {
		config.update((value) => {
			if (swapXY) {
				value.yAxis = { ...value.yAxis, ...chartOverrides.xAxis };
				value.xAxis = { ...value.xAxis, ...chartOverrides.yAxis };
			} else {
				value.yAxis[0] = { ...value.yAxis[0], ...chartOverrides.yAxis };
				value.xAxis = { ...value.xAxis, ...chartOverrides.xAxis };
				if (resolvedY2) {
					value.yAxis[1] = { ...value.yAxis[1], show: true };
					if (['line', 'bar', 'scatter'].includes(y2SeriesType)) {
						for (let index = 0; index < y2Count; index++) {
							value.series[yCount + index].type = y2SeriesType;
						}
					}
				}
			}
			if (labels) value.axisPointer = { triggerEmphasis: false };
			return value;
		});
	});
</script>
