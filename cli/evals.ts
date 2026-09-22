// Eval YAML is data, not executable code. Cloud loads one current published file;
// this parser shares the CLI's existing YAML dependency without managing discovery or suites.
import yaml from 'js-yaml'

export interface EvalDefinition {
  name: string
  question: string
  rubric: string
}

// Validate one definition; the caller already selected its exact project-relative path.
export function parseEval(file: {path: string; contents: string}): EvalDefinition {
  let value = yaml.safeLoad(file.contents) as Record<string, unknown> | undefined
  if (!value || typeof value != 'object' || Array.isArray(value) || typeof value.question != 'string' || !value.question.trim() || typeof value.rubric != 'string' || !value.rubric.trim()) {
    throw new Error(`${file.path}: expected question and rubric strings`)
  }
  if (Object.keys(value).some(key => !['question', 'rubric'].includes(key))) throw new Error(`${file.path}: only question and rubric are supported`)
  return {name: file.path.replace(/^evals\//, '').replace(/\.ya?ml$/, ''), question: value.question, rubric: value.rubric}
}
