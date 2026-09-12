import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const bundlePath = path.resolve(
  import.meta.dirname,
  '../../node_modules/@diffusionstudio/vits-web/dist/vits-web.js',
)
const floatingUrl =
  '"https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize"'
const sameOriginUrl =
  'new URL("vendor/voice-runtime/piper_phonemize", document.baseURI).href'

const bundle = await readFile(bundlePath, 'utf8')
if (bundle.includes(floatingUrl)) {
  const occurrences = bundle.split(floatingUrl).length - 1
  if (occurrences !== 1) {
    throw new Error(`Expected one Piper CDN URL, found ${occurrences}`)
  }
  await writeFile(bundlePath, bundle.replace(floatingUrl, sameOriginUrl))
} else if (!bundle.includes(sameOriginUrl)) {
  throw new Error('Pinned vits-web layout changed; same-origin patch not applied')
}
