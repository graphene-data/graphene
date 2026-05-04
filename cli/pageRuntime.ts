import {collectComponentRequests} from '../lang/componentQueries.ts'
import {collectSveltishOpeningTags, extractSveltishAttributes, sveltishAttributeValues, type SveltishIgnoredRange} from '../lang/sveltish.ts'
import {formatSourceLocation} from '../lang/util.ts'
import {dateRangeDefault, dropdownDefault} from '../ui/component-utilities/pageInputDefaults.ts'

export interface PageFence extends SveltishIgnoredRange {
  name: string
  contents: string
}

export interface PageInput {
  component: string
  name: string
  keys: string[]
  defaultValue: any
  effectiveValue: any
  location: string
}

const FENCE = /^([ \t]*)(`{3,})([^\n]*)\n([\s\S]*?)^\1\2[ \t]*$/gim

export function buildPageRuntime(contents: string, mdPath: string, overrides: Record<string, any>) {
  let fences = collectPageFences(contents)
  let inputs = collectPageInputs(contents, fences, mdPath)
  let params: Record<string, any> = {}
  inputs.forEach(input => {
    if (input.keys.length == 1) {
      params[input.keys[0]] = input.effectiveValue
      return
    }
    input.keys.forEach(key => (params[key] = input.effectiveValue?.[key.replace(`${input.name}_`, '')] ?? null))
  })

  Object.assign(params, overrides)
  inputs.forEach(input => {
    input.effectiveValue = input.keys.length == 1 ? params[input.keys[0]] : Object.fromEntries(input.keys.map(key => [key, params[key]]))
  })

  return {fences, inputs, params, componentRequests: collectComponentRequests(contents, fences, mdPath)}
}

function collectPageFences(contents: string): PageFence[] {
  let fences: PageFence[] = []
  FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FENCE.exec(contents))) {
    let header = (match[3] || '').trim()
    let [language, name] = header.split(/\s+/)
    if (!name || !['sql', 'gsql'].includes((language || '').toLowerCase())) continue
    let start = match.index || 0
    fences.push({name, contents: match[4] || '', start, end: start + match[0].length})
  }
  return fences
}

function collectPageInputs(contents: string, fences: PageFence[], mdPath: string): PageInput[] {
  let inputs: PageInput[] = []
  for (let tag of collectSveltishOpeningTags(contents, fences)) {
    if (!['Dropdown', 'TextInput', 'DateRange'].includes(tag.name)) continue
    let attrs = extractSveltishAttributes(tag.fragment, tag.start)
    let name = attrs.name?.value
    if (!name) continue

    let location = formatSourceLocation(contents, mdPath, tag.start)
    if (tag.name == 'TextInput') {
      let value = attrs.defaultValue?.value ?? null
      inputs.push({component: tag.name, name, keys: [name], defaultValue: value, effectiveValue: value, location})
    }

    if (tag.name == 'Dropdown') {
      let value = dropdownDefault(sveltishAttributeValues(attrs))
      inputs.push({component: tag.name, name, keys: [name], defaultValue: value, effectiveValue: value, location})
    }

    if (tag.name == 'DateRange') {
      let value = dateRangeDefault(sveltishAttributeValues(attrs))
      inputs.push({component: tag.name, name, keys: [`${name}_start`, `${name}_end`], defaultValue: value, effectiveValue: value, location})
    }
  }
  return inputs
}
