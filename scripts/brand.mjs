// Generates the logo files in brand/logo from brand/mark.js. Everything is drawn from pixel
// cells, so the output never depends on installed fonts. Run with `npm run brand`.
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { MARK, COLORS, cellsToPath, wordPath } from '../brand/mark.js'

const VARIANTS = {
  color: { a: COLORS.gold, b: COLORS.blue, text: COLORS.ink, bg: COLORS.space },
  ink: { a: COLORS.space, b: COLORS.space, text: COLORS.space, bg: COLORS.ink },
  white: { a: '#FFFFFF', b: '#FFFFFF', text: '#FFFFFF', bg: COLORS.space },
  gold: { a: COLORS.gold, b: COLORS.gold, text: COLORS.gold, bg: COLORS.space },
}

const markSvg = (v, pad = 0) => {
  const s = MARK.size + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}" shape-rendering="crispEdges">
  <path fill="${v.a}" d="${cellsToPath(MARK.a)}"/>
  <path fill="${v.b}" d="${cellsToPath(MARK.b)}"/>
</svg>
`
}

// mark 16 units tall, wordmark 7 rows of 2 units, baseline aligned to the big star
const lockupSvg = (v) => {
  const unit = 2
  const x0 = MARK.size + 4
  const w = x0 + (11 * 6 - 1) * unit
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${MARK.size}" shape-rendering="crispEdges">
  <path fill="${v.a}" d="${cellsToPath(MARK.a)}"/>
  <path fill="${v.b}" d="${cellsToPath(MARK.b)}"/>
  <path fill="${v.text}" d="${wordPath('stellarcope', x0, 1, unit)}"/>
</svg>
`
}

const iconSvg = (v) => markSvg(v, 4).replace('<path', `<rect x="-4" y="-4" width="24" height="24" fill="${v.bg}"/>\n  <path`)

// render straight at the target size so pixel edges stay crisp, no resampling seams
const png = (svg, width, out) => {
  const vbw = Number(svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/)[1])
  return sharp(Buffer.from(svg), { density: (72 * width) / vbw }).png().toFile(out)
}

await mkdir('brand/logo', { recursive: true })
for (const [name, v] of Object.entries(VARIANTS)) {
  const m = markSvg(v)
  const l = lockupSvg(v)
  await writeFile(`brand/logo/mark-${name}.svg`, m)
  await writeFile(`brand/logo/lockup-${name}.svg`, l)
  await png(m, 1024, `brand/logo/mark-${name}.png`)
  await png(l, 2400, `brand/logo/lockup-${name}.png`)
}
const icon = iconSvg(VARIANTS.color)
await writeFile('brand/logo/app-icon.svg', icon)
await png(icon, 1024, 'brand/logo/app-icon.png')
await writeFile('public/favicon.svg', iconSvg(VARIANTS.color))
await png(icon, 180, 'public/apple-touch-icon.png')
console.log('brand/logo written')
