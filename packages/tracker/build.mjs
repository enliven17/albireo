// Builds the hosted tracker into dist/<version>/a.js and prints its SRI hash.
// Versions are immutable: a published version is never rebuilt in place.
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'

const { version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url)))
const dir = new URL(`./dist/${version}/`, import.meta.url)
const out = new URL('a.js', dir)

if (await access(out).then(() => true, () => false) && !process.argv.includes('--force')) {
  console.error(`dist/${version}/a.js exists. Bump the version instead of rebuilding a published file.`)
  process.exit(1)
}

await mkdir(dir, { recursive: true })
const result = await build({
  entryPoints: [new URL('./script.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2018',
  write: false,
  legalComments: 'none',
})
const code = result.outputFiles[0].contents
await writeFile(out, code)
const sri = `sha384-${createHash('sha384').update(code).digest('base64')}`
await writeFile(new URL('integrity.txt', dir), `${sri}\n`)
console.log(`a.js ${code.length} bytes, ${version}\n${sri}`)
