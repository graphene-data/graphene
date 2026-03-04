// Helper function for multi-series tooltips:
// Returns the yAxisIndex for a series since we can't currently access that in ECharts' params
export default function getYAxisIndex(componentIndex, yCount, y2Count) {
  let totalPatternCount = yCount + y2Count

  // Find the position of the index in the repeating sequence
  let positionInPattern = componentIndex % totalPatternCount

  // If the position lies within yCount, return 0, otherwise return 1
  if (positionInPattern < yCount) {
    return 0
  } else {
    return 1
  }
}
