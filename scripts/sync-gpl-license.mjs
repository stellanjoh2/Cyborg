import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const url =
  'https://raw.githubusercontent.com/espeak-ng/espeak-ng/4870adfa25b1a32b4361592f1be8a40337c58d6c/COPYING'
const expected =
  '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903'
const response = await fetch(url)
if (!response.ok) throw new Error(`GPL download failed: ${response.status}`)
const text = await response.text()
const actual = createHash('sha256').update(text).digest('hex')
if (actual !== expected) {
  throw new Error(`GPL hash mismatch: expected ${expected}, received ${actual}`)
}

const directory = path.resolve(import.meta.dirname, '../third_party/licenses')
await mkdir(directory, { recursive: true })
await writeFile(path.join(directory, 'GPL-3.0-or-later.txt'), text)
