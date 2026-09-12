import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const chrome =
  process.env.CHROME_BIN ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const localUrl = 'http://127.0.0.1:4173/Cyborg/'
const targetUrl = process.argv[2] ?? localUrl
const port = 9300 + (process.pid % 500)
const profile = await mkdtemp(path.join(tmpdir(), 'lx01-chrome-'))
let preview
let browser

const waitFor = async (check, timeoutMs = 30_000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await check()
      if (result) return result
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Timed out waiting for browser smoke-test service')
}

try {
  if (targetUrl === localUrl) {
    preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1'], {
      stdio: 'ignore',
    })
    await waitFor(async () => (await fetch(localUrl)).ok)
  }

  browser = spawn(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1440,1200',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      targetUrl,
    ],
    { stdio: 'ignore' },
  )

  const page = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`)
    const pages = await response.json()
    return pages.find((candidate) => candidate.type === 'page')
  })
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 0
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      const listener = (event) => {
        const message = JSON.parse(event.data)
        if (message.id !== id) return
        socket.removeEventListener('message', listener)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
      }
      socket.addEventListener('message', listener)
      socket.send(JSON.stringify({ id, method, params }))
    })

  await command('Runtime.enable')
  const evaluation = await command('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const base = new URL('vendor/voice-runtime/', document.baseURI)
      let directBytes = 0
      let directError = ''
      let directLogs = ''
      try {
        const espeakFactory = (await import(new URL('espeak-ng.js', base))).default
        const locateFile = (file) => new URL(file, base).href
        const probe = await espeakFactory({ noInitialRun: true, locateFile })
        const phondata = '/usr/local/share/espeak-ng-data/phondata'
        const exists = probe.FS.analyzePath(phondata).exists
        const bytes = exists ? probe.FS.readFile(phondata) : new Uint8Array()
        const head = Array.from(bytes.subarray(0, 8))
        directLogs += 'phondata exists=' + exists + ' size=' + bytes.length + ' head=' + JSON.stringify(head) + '\\n'
        const direct = await espeakFactory({
          locateFile,
          print: (line) => { directLogs += line + '\\n' },
          printErr: (line) => { directLogs += line + '\\n' },
          preRun: [(module) => module.FS.writeFile('/smoke.txt', 'Hello world')],
          arguments: ['-w', '/smoke.wav', '-v', 'en-us', '-f', '/smoke.txt'],
        })
        directBytes = direct.FS.readFile('/smoke.wav').byteLength
      } catch (error) {
        directError = error.stack || error.message || String(error)
      }

      let piperOutput = ''
      let piperError = ''
      try {
        const piperSource = await (await fetch(new URL('piper_phonemize.js', base))).text()
        ;(0, eval)(piperSource + ';globalThis.__piperFactory=createPiperPhonemize')
        const piper = await globalThis.__piperFactory({
          print: (line) => { piperOutput += line },
          locateFile: (file) => new URL(file, base).href,
        })
        piper.callMain([
          '-l',
          'en-us',
          '--input',
          JSON.stringify([{ text: 'Hello world' }]),
          '--espeak_data',
          '/espeak-ng-data',
        ])
      } catch (error) {
        piperError = error.stack || error.message || String(error)
      }

      const applicationBundles = await Promise.all(
        [...document.scripts]
          .map((script) => script.src)
          .filter(Boolean)
          .map(async (url) => (await fetch(url)).text()),
      )
      return {
        directBytes,
        directError,
        directLogs,
        piperProducedJson: piperOutput.includes('phoneme_ids'),
        piperError,
        larynxLabelBundled: applicationBundles.some((code) => code.includes('LARYNX')),
      }
    })()`,
  })

  if (evaluation.exceptionDetails) {
    throw new Error(JSON.stringify(evaluation.exceptionDetails))
  }
  const result = evaluation.result.value
  if (
    result.directBytes <= 44 ||
    !result.piperProducedJson ||
    !result.larynxLabelBundled
  ) {
    throw new Error(`Browser smoke test failed: ${JSON.stringify(result)}`)
  }
  console.log(JSON.stringify(result))
  socket.close()
} finally {
  preview?.kill()
  browser?.kill()
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}
