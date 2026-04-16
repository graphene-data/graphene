export const getFinalColumnOrder = (columns: string[], priorityColumns: Array<string | undefined>): string[] => {
  let priorities = priorityColumns.filter(Boolean) as string[]
  let restColumns = columns.filter(key => !priorities.includes(key))
  return [...priorities, ...restColumns]
}
