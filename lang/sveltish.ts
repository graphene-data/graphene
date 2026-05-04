export interface SveltishAttribute {
  key: string
  keyStart: number
  keyEnd: number
  value: string
  start: number
  end: number
}

export interface SveltishIgnoredRange {
  start: number
  end: number
}

export interface SveltishTag {
  name: string
  fragment: string
  start: number
}

const COMPONENT_TAG = /<([A-Z][A-Za-z0-9]*)\b(?:[^>"']|"[^"]*"|'[^']*')*(?:\/>|>)/g

/**
 * Extract attributes from the self-closing Svelte-ish component tags we support in markdown.
 *
 * This is intentionally a small scanner rather than a full Svelte parser. The markdown analysis path
 * only needs static attributes from tags like `<BarChart data=foo x="month" label />` so it can:
 * - translate chart field props into virtual GSQL and map field errors back to the prop value
 * - report unsupported wrapper props and underline the prop name
 *
 * A regex used to be enough when we only supported `key="value"`, but real markdown commonly uses
 * unquoted props, single-quoted props, and boolean props. We also skip `{...}` / `{expr}` chunks so
 * dynamic Svelte syntax does not get mistaken for a static attribute. This is not intended to validate
 * arbitrary Svelte syntax; it just recognizes the static subset Graphene can analyze.
 */
export function extractSveltishAttributes(fragment: string, baseStart: number): Record<string, SveltishAttribute> {
  let attrs: Record<string, SveltishAttribute> = {}

  let name = fragment.match(/^<([A-Z][A-Za-z0-9]*)/)?.[1]
  let i = name ? name.length + 1 : 1
  while (i < fragment.length) {
    i = skipWhitespace(fragment, i)
    if (!fragment[i] || fragment[i] == '/' || fragment[i] == '>') break

    if (fragment[i] == '{') {
      i = skipSvelteExpression(fragment, i)
      continue
    }

    if (!/[\w:-]/.test(fragment[i])) {
      i++
      continue
    }

    let key = readAttributeKey(fragment, i)
    i = skipWhitespace(fragment, key.end)
    let value = readAttributeValue(fragment, i, key.start, key.end)
    i = value.next

    attrs[key.value] = {
      key: key.value,
      keyStart: baseStart + key.start,
      keyEnd: baseStart + key.end,
      value: value.value,
      start: baseStart + value.start,
      end: baseStart + value.end,
    }
  }
  return attrs
}

export function sveltishAttributeValues(attrs: Record<string, SveltishAttribute | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(attrs).map(([key, attr]) => [key, attr?.value]))
}

export function collectSveltishOpeningTags(contents: string, ignoredRanges: SveltishIgnoredRange[] = []): SveltishTag[] {
  let tags: SveltishTag[] = []
  COMPONENT_TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COMPONENT_TAG.exec(contents))) {
    let start = match.index || 0
    if (ignoredRanges.some(range => start >= range.start && start < range.end)) continue
    tags.push({name: match[1], fragment: match[0], start})
  }
  return tags
}

function skipWhitespace(fragment: string, i: number) {
  while (/\s/.test(fragment[i] || '')) i++
  return i
}

function skipSvelteExpression(fragment: string, i: number) {
  while (fragment[i] && fragment[i] != '}') i++
  return fragment[i] == '}' ? i + 1 : i
}

function readAttributeKey(fragment: string, start: number) {
  let end = start
  while (/[\w:-]/.test(fragment[end] || '')) end++
  return {value: fragment.slice(start, end), start, end}
}

function readAttributeValue(fragment: string, i: number, keyStart: number, keyEnd: number) {
  if (fragment[i] != '=') return {value: 'true', start: keyStart, end: keyEnd, next: i}

  i = skipWhitespace(fragment, i + 1)
  let quote = fragment[i] == '"' || fragment[i] == "'" ? fragment[i] : ''
  if (!quote) return readUnquotedValue(fragment, i)

  let start = i + 1
  let end = start
  while (fragment[end] && fragment[end] != quote) end++
  return {value: fragment.slice(start, end), start, end, next: fragment[end] == quote ? end + 1 : end}
}

function readUnquotedValue(fragment: string, start: number) {
  let end = start
  while (fragment[end] && !/\s/.test(fragment[end]) && fragment[end] != '/' && fragment[end] != '>') end++
  return {value: fragment.slice(start, end), start, end, next: end}
}
