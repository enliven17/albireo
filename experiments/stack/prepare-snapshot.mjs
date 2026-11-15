// Only known source/assets are copied. No .env files, git state, or live data.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
const root = new URL('../../', import.meta.url)
const destination = new URL('./snapshot/', import.meta.url)
await mkdir(destination, { recursive: true })
for (const path of ['src', 'packages', 'services', 'api', 'db', 'scripts', 'public', 'brand/mark.js', 'brand/mark.d.ts', 'index.html', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts']) {
  await cp(new URL(path, root), new URL(path, destination), { recursive: true, filter: (path) => !path.includes('/node_modules/') })
}
const manifest = JSON.parse(await readFile(new URL('package.json', root)))
manifest.name = 'albireo-compatibility-snapshot'
Object.assign(manifest.dependencies, { pg: '8.23.1', '@stellar/stellar-sdk': '17.4.0', react: '19.3.1', 'react-dom': '19.3.1', 'react-router-dom': '7.18.5' })
Object.assign(manifest.devDependencies, {
  typescript: '6.0.3', vite: '8.3.8', '@vitejs/plugin-react': '6.3.0', '@tailwindcss/vite': '4.3.5',
  '@types/node': '24.19.2', '@types/pg': '8.23.1', '@types/react': '19.3.0', '@types/react-dom': '19.3.0',
})
await writeFile(new URL('package.json', destination), JSON.stringify(manifest, null, 2) + '\n')
await cp(new URL('./frontend.package-lock.json', import.meta.url), new URL('package-lock.json', destination))
// React 19's RefObject generic includes null explicitly. This is a type-only migration.
for (const path of ['src/lib/reveal.ts', 'src/lib/smooth.ts']) {
  const url = new URL(path, destination)
  const source = await readFile(url, 'utf8')
  await writeFile(url, source.replaceAll('RefObject<HTMLElement>', 'RefObject<HTMLElement | null>'))
}
const sessionUrl = new URL('packages/core/session.ts', destination)
await writeFile(sessionUrl, (await readFile(sessionUrl, 'utf8')).replace('private salt = Buffer.alloc(0)', 'private salt: Buffer = Buffer.alloc(0)'))
console.log('Isolated source snapshot prepared; application files were not modified.')
