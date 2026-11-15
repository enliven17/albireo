import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import ts from 'typescript'
const source = process.env.UMAMI_SOURCE ?? '/private/tmp/albireo-umami-v3.5.0'
const directory = new URL('./upstream/', import.meta.url)
await mkdir(directory, { recursive: true })
const manifest = { upstream: 'https://github.com/umami-software/umami/tree/v3.5.0', revision: 'd3c62a8', files: {} }
for (const name of ['collection-session', 'crypto', 'app-secret']) {
  const code = await readFile(`${source}/src/lib/${name}.ts`, 'utf8')
  manifest.files[`${name}.ts`] = createHash('sha256').update(code).digest('hex')
  await writeFile(new URL(`${name}.ts`, directory), code.replaceAll("from './crypto'", "from './crypto.ts'").replaceAll("from './app-secret'", "from './app-secret.ts'"))
  const runnable = code.replaceAll("from './crypto'", "from './crypto.mjs'").replaceAll("from './app-secret'", "from './app-secret.mjs'")
  await writeFile(new URL(`${name}.mjs`, directory), ts.transpileModule(runnable, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText)
}
await writeFile(new URL('collection-session.d.mts', directory), `export type Session = {sessionId:string;visitId:string;iat:number;sessionDrift:boolean};
export declare function resolveCollectionSession(input:{sourceId:string;ip:string;userAgent:string;createdAt:Date;historical?:boolean;cache?:Session & {websiteId:string}}):Session;\n`)
await writeFile(new URL('LICENSE', directory), await readFile(`${source}/LICENSE`, 'utf8'))
await writeFile(new URL('SOURCE.json', directory), JSON.stringify(manifest, null, 2) + '\n')
console.log('Pinned upstream resolver copied; only relative import extensions were adapted.')
