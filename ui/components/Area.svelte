<script>
	import { beforeUpdate, getContext } from 'svelte';
	import { propKey, configKey } from '@evidence-dev/component-utilities/chartContext';
	import getSeriesConfig from '@evidence-dev/component-utilities/getSeriesConfig';
	import formatTitle from '@evidence-dev/component-utilities/formatTitle';
	import replaceNulls from '@evidence-dev/component-utilities/replaceNulls';
	import getCompletedData from '@evidence-dev/component-utilities/getCompletedData';
	import {
		formatValue,
		getFormatObjectFromString
	} from '@evidence-dev/component-utilities/formatting';
	import { getThemeStores } from './themeStores';

	const { resolveColor } = getThemeStores();
	const props = getContext(propKey);
	const config = getContext(configKey);

	export let y = undefined;
	const ySet = !!y;
	export let series = undefined;
	const seriesSet = !!series;
	export let options = undefined;
	export let name = undefined;
	export let type = 'stacked';
	export let fillColor = undefined;
	$: fillColorStore = resolveColor(fillColor);
	export let lineColor = undefined;
	$: lineColorStore = resolveColor(lineColor);
	export let fillOpacity = undefined;
	export let line = true;
	$: line = line === 'true' || line === true;
	export let markers = false;
	$: markers = markers === 'true' || markers === true;
	export let markerShape = 'circle';
	export let markerSize = 8;
	export let handleMissing = 'gap';
	export let step = false;
	$: step = step === 'true' || step === true;
	export let stepPosition = 'end';
	export let labels = false;
	$: labels = labels === 'true' || labels === true;
	export let labelSize = 11;
	export let labelPosition = 'top';
	export let labelColor = undefined;
	$: labelColorStore = resolveColor(labelColor);
	export let labelFmt = undefined;
	export let showAllLabels = false;
	export let seriesOrder = undefined;
	export let seriesLabelFmt = undefined;

	let labelFormat;
	let data;
	let x;
	let swapXY;
	let yFormat;
	let xType;
	let xMismatch;
	let columnSummary;
	let seriesConfig;
	let chartOverrides;
	let defaultLabelPosition;
	let resolvedY;
	let stackName;

	if (labelFmt) labelFormat = getFormatObjectFromString(labelFmt);

	$: data = $props.data;
	$: x = $props.x;
	$: swapXY = $props.swapXY;
	$: yFormat = $props.yFormat;
	$: xType = $props.xType;
	$: xMismatch = $props.xMismatch;
	$: columnSummary = $props.columnSummary;
	$: series = seriesSet ? series : $props.series;
	$: resolvedY = ySet ? y : $props.y;

	$: {
		if (!series && typeof resolvedY !== 'object') {
			stackName = undefined;
			if (columnSummary?.[resolvedY]) name = name ?? formatTitle(resolvedY, columnSummary[resolvedY].title);
		} else {
			stackName = 'area';
			data = getCompletedData(data, x, resolvedY, series, false, xType === 'value');
			data = replaceNulls(data, resolvedY);
			xType = xType === 'value' ? 'category' : xType;
		}
	}

	$: if (handleMissing === 'zero') data = replaceNulls(data, resolvedY);

	const labelPositions = { above: 'top', below: 'bottom', middle: 'inside' };
	const swapXYLabelPositions = { above: 'right', below: 'left', middle: 'inside' };

	$: {
		defaultLabelPosition = swapXY ? 'right' : 'top';
		labelPosition = (swapXY ? swapXYLabelPositions[labelPosition] : labelPositions[labelPosition]) ?? defaultLabelPosition;
	}

	$: baseConfig = {
		type: 'line',
		stack: stackName,
		areaStyle: { color: $fillColorStore, opacity: fillOpacity },
		connectNulls: handleMissing === 'connect',
		lineStyle: { width: line ? 1 : 0, color: $lineColorStore },
		label: {
			show: labels,
			formatter: (params) =>
				params.value[swapXY ? 0 : 1] === 0
					? ''
					: formatValue(params.value[swapXY ? 0 : 1], labelFormat ?? yFormat),
			fontSize: labelSize,
			color: $labelColorStore,
			position: labelPosition,
			padding: 3
		},
		labelLayout: { hideOverlap: showAllLabels ? false : true },
		emphasis: { focus: 'series' },
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
		undefined,
		seriesLabelFmt
	);

	$: config.update((value) => {
		value.series.push(...seriesConfig);
		value.legend.data.push(...seriesConfig.map((entry) => entry.name.toString()));
		return value;
	});

	$: if (options) {
		config.update((value) => ({ ...value, ...options }));
	}

	$: chartOverrides = {
		yAxis: { boundaryGap: ['0%', '1%'] },
		xAxis: { boundaryGap: ['4%', '4%'], type: xType }
	};

	beforeUpdate(() => {
		config.update((value) => {
			value.tooltip = { ...value.tooltip, order: 'seriesDesc' };
			if (swapXY) {
				value.yAxis = { ...value.yAxis, ...chartOverrides.xAxis };
				value.xAxis = { ...value.xAxis, ...chartOverrides.yAxis };
			} else {
				value.yAxis[0] = { ...value.yAxis[0], ...chartOverrides.yAxis };
				value.xAxis = { ...value.xAxis, ...chartOverrides.xAxis };
			}
			if (type === 'stacked100') {
				if (swapXY) value.xAxis = { ...value.xAxis, max: 1 };
				else value.yAxis[0] = { ...value.yAxis[0], max: 1 };
			}
			if (labels) value.axisPointer = { triggerEmphasis: false };
			return value;
		});
	});
</script>
