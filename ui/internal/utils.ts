// Format filenames consistently for navigation and browser titles.
export function prettyPrintFilename(filename: string, explicitTitle?: string) {
  if (explicitTitle) return explicitTitle
  let cleaned = filename.replace(/\.md$/, '')
  if (cleaned.toLowerCase() === 'index') return 'Home'
  return cleaned
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(component => component.charAt(0).toUpperCase() + component.slice(1))
    .join(' ')
}
