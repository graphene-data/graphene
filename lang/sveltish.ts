export interface SveltishAttribute {
  key: string
  keyStart: number
  keyEnd: number
  value: string
  start: number
  end: number
}

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
