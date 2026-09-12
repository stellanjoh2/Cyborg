import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const nodeModules = path.join(root, 'node_modules')
const overrideDirectory = path.join(root, 'third_party/licenses')
const overrides = JSON.parse(
  await readFile(path.join(overrideDirectory, 'npm-overrides.json'), 'utf8'),
)
const rootPackage = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
)

const packageNames = new Set()
const queue = Object.keys(rootPackage.dependencies ?? {})

while (queue.length > 0) {
  const name = queue.shift()
  if (!name || packageNames.has(name)) continue
  const packagePath = path.join(nodeModules, name, 'package.json')
  try {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
    packageNames.add(name)
    queue.push(
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
    )
  } catch {
    // Optional platform packages may not be installed on this machine.
  }
}

const sections = []
for (const name of [...packageNames].sort()) {
  const packageDir = path.join(nodeModules, name)
  const packageJson = JSON.parse(
    await readFile(path.join(packageDir, 'package.json'), 'utf8'),
  )
  const files = await readdir(packageDir)
  const licenseFiles = files
    .filter((file) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file))
    .sort()

  const repository =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url
  const metadata = [
    `- Version: ${packageJson.version ?? 'unknown'}`,
    `- Declared license: ${packageJson.license ?? 'not declared'}`,
    repository ? `- Source: ${repository}` : null,
  ].filter(Boolean)

  const notices = []
  for (const file of licenseFiles) {
    const text = (await readFile(path.join(packageDir, file), 'utf8')).trim()
    notices.push(`### ${file}\n\n\`\`\`text\n${text}\n\`\`\``)
  }
  const override = overrides[name]
  if (notices.length === 0 && override) {
    const text = (
      await readFile(path.join(overrideDirectory, override), 'utf8')
    ).trim()
    notices.push(`### ${override}\n\n\`\`\`text\n${text}\n\`\`\``)
  }
  if (notices.length === 0) {
    notices.push(
      '_No license file was included in the installed npm package. See the declared source and THIRD_PARTY_NOTICES.md for project-specific provenance._',
    )
  }

  sections.push(
    `## ${name}\n\n${metadata.join('\n')}\n\n${notices.join('\n\n')}`,
  )
}

const output = `# Third-Party Software Licenses

Generated from the installed production dependency tree by
\`npm run licenses\`. Voice-model and source-data terms are documented
separately in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

${sections.join('\n\n')}
`

await writeFile(path.join(root, 'THIRD_PARTY_LICENSES.md'), output)
