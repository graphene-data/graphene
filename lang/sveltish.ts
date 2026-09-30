export interface SveltishAttribute {
  key: string
  keyStart: number
  keyEnd: number
  value: string
  dynamic?: boolean
  start: number
  end: number
}

/**
 * Extract attributes from opening Svelte-ish component tags, including self-closing tags.
 *
 * This is intentionally a small scanner rather than a full Svelte parser. The markdown analysis path
 * only needs static attributes from tags like `<BarChart data=foo x="month" label />` so it can:
 * - translate chart field props into virtual GSQL and map field errors back to the prop value
 * - report unsupported wrapper props and underline the prop name
 *
 * A regex used to be enough when we only supported `key="value"`, but real markdown commonly uses
 * unquoted props, single-quoted props, and boolean props. Standalone `{...}` / `{expr}` chunks are
 * skipped; expressions assigned to attributes are preserved and marked dynamic. This is not intended to validate
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
      ...(value.value.includes('{') ? {dynamic: true} : {}),
      start: baseStart + value.start,
      end: baseStart + value.end,
    }
  }
  return attrs
}

function skipWhitespace(fragment: string, i: number) {
  while (/\s/.test(fragment[i] || '')) i++
  return i
}

// Skip nested expressions intact so whitespace and comparisons cannot become spurious attributes.
function skipSvelteExpression(fragment: string, i: number) {
  let depth = 0
  let quote = ''
  for (; i < fragment.length; i++) {
    let ch = fragment[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
    } else if ('"\'`'.includes(ch)) quote = ch
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i + 1
  }
  return i
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
  if (fragment[start] === '{') {
    let end = skipSvelteExpression(fragment, start)
    return {value: fragment.slice(start, end), start, end, next: end}
  }
  let end = start
  while (fragment[end] && !/\s/.test(fragment[end]) && fragment[end] != '/' && fragment[end] != '>') end++
  return {value: fragment.slice(start, end), start, end, next: end}
}
