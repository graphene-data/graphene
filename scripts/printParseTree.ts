// This script prints out the tree Lezer parses from a given gsql file.
// Use it to identify the issue when you think something has been parsed incorrectly.

// @ts-expect-error - imports from lang workspace
import type {TreeCursor} from '@lezer/common'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import {parser} from '../lang/parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const argPath = process.argv[2]
if (!argPath) {
  console.error('Usage: tsx scripts/printParseTree.ts <file.gsql>')
  process.exit(1)
}

const inputPath = path.resolve(process.cwd(), argPath)

const contents = await readFile(inputPath, 'utf-8')
const tree = parser.parse(contents)
const cursor = tree.cursor()

function printNode (cursor: TreeCursor, source: string, indent = ''): void {
  let name = cursor.type.name
  let text = source.slice(cursor.from, cursor.to).replace(/\s+/g, ' ').trim()
  let preview = text.length > 80 ? `${text.slice(0, 77)}…` : text
  let range = `[${cursor.from}, ${cursor.to}]`
  let suffix = preview ? `: ${preview}` : ''
  console.log(`${indent}${name} ${range}${suffix}`)

  if (!cursor.firstChild()) return

  do {
    printNode(cursor, source, `${indent}  `)
  } while (cursor.nextSibling())

  cursor.parent()
}

printNode(cursor, contents)
