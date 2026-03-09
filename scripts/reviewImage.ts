import dotenv from 'dotenv'
import {readFile} from 'fs/promises'
import path, {extname} from 'path'
import {fileURLToPath} from 'url'

dotenv.config({path: path.join(fileURLToPath(import.meta.url), '../../.env'), quiet: true})

const args = process.argv.slice(2)
const [prompt, ...flagArgs] = args

if (!prompt) {
  console.error('Usage: node scripts/reviewImage.ts "<prompt>" --<label>=<image-path> [--role=<qa|designer|...>]')
  process.exit(1)
}

const imageFlags = new Map<string, string>()
let roleName: string | undefined

for (let flag of flagArgs) {
  if (!flag.startsWith('--') || !flag.includes('=')) {
    console.error(`Invalid flag: ${flag}. Expected format --name=value`)
    process.exit(1)
  }

  let [rawKey, value] = flag.slice(2).split(/=(.+)/)
  let key = rawKey.trim()
  let trimmedValue = value?.trim()

  if (!key || !trimmedValue) {
    console.error(`Invalid flag: ${flag}. Expected format --name=value`)
    process.exit(1)
  }

  if (key === 'role') {
    roleName = trimmedValue.toLowerCase()
    continue
  }

  imageFlags.set(key, trimmedValue)
}

if (imageFlags.size === 0) {
  console.error('Provide at least one image flag, e.g. --base=path/to/image.png')
  process.exit(1)
}

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY environment variable')
  process.exit(1)
}

type ResponseContent = {type?: string; text?: string}
type ResponseItem = {content?: ResponseContent[]}
type ResponsePayload = {
  output_text?: string
  output?: ResponseItem[]
}

const rolePrompts: Record<string, string> = {
  qa: 'You are an experienced visual QA specialist focused on spotting regressions, mismatched layouts, and rendering defects. Compare every image carefully and call out even subtle differences that could impact production quality.',
  designer: 'You are a senior product designer assessing visual quality, hierarchy, and brand consistency. Offer critiques that help designers understand how to refine the experience.',
}

const defaultSystemPrompt = "You are a meticulous visual reviewer with an eye for detail and keen design sense. Describe exactly what you see and call out anything relevant to the user's prompt."

const systemPrompt = roleName && rolePrompts[roleName] ? rolePrompts[roleName] : defaultSystemPrompt

const mimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
}

type PreparedImage = {label: string; dataUrl: string}

const preparedImages: PreparedImage[] = []

for (let [label, imagePath] of imageFlags) {
  let imageBuffer = await readFile(imagePath)
  let extension = extname(imagePath).toLowerCase()
  let mimeType = mimeTypes[extension] ?? 'image/png'
  let dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`
  preparedImages.push({label, dataUrl})
}

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-5',
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: systemPrompt,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {type: 'input_text', text: prompt},
          ...preparedImages.flatMap(({label, dataUrl}) => [
            {
              type: 'input_text',
              text: `Image reference [${label}]`,
            },
            {
              type: 'input_image',
              image_url: dataUrl,
            },
          ]),
        ],
      },
    ],
  }),
})

if (!response.ok) {
  let errText = await response.text().catch(() => 'Unknown error')
  console.error('Request failed:', errText)
  process.exit(1)
}

const data = (await response.json()) as ResponsePayload
let output = data.output_text?.trim()

if (!output && Array.isArray(data.output)) {
  output = data.output
    .flatMap(item => item?.content ?? [])
    .filter(part => part?.type === 'output_text' && part.text)
    .map(part => part.text!.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

if (!output) {
  console.log(JSON.stringify(data, null, 2))
  process.exit(0)
}

console.log(output)
