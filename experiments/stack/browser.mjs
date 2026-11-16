import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve(process.env.STELLARCOPE_BROWSER_ROOT ?? fileURLToPath(new URL('./snapshot/dist/', import.meta.url)))
const results = new URL('./results/browser/', import.meta.url)
await mkdir(results, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname
    const path = resolve(root, `.${pathname}`)
    assert.ok(path === root || path.startsWith(`${root}/`))
    const file = extname(path) ? path : `${root}/index.html`
    res.setHeader('content-type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png' })[extname(file)] ?? 'application/octet-stream')
    res.end(await readFile(file))
  } catch { res.statusCode = 404; res.end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const points = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i+1).padStart(2,'0')}`, value: 1 }))
const checks = { sep1: true, dns: true, meta: false, origin: true, sealed: false }
const stats = {
  tenant: { id: 'stellarcope', name: 'Stellarcope Lab', category: 'Analytics', scf_round: null }, days: 30,
  web: { visitors: points, pageviewSeries: points, total: 30, pageviews: 30, delta: null, bounce: 0.2, session: 42, pages: [], referrers: [], countries: [], devices: [], browsers: [], events: [], heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)) },
  api: { requests: points, latency: points, total: 30, errorRate: 0, p50: 50, p95: 100, status: [], routes: [] },
  wallets: { funnel: ['wallet_modal_open','wallet_connected','tx_sign_requested','tx_signed'].map(label=>({label,value:0})), share: [] },
  trust: { score: 90, formula: 'lab', checks, domains: [{ domain: 'lab.invalid', method: 'dns', verified: true }], filtered: 0, drops: [] },
}
const projects = [{ id: 'stellarcope', name: 'Stellarcope Lab', category: 'Analytics', scf_round: null, visitors: 30, pageviews: 30, visitorSeries: points, requests: 30, p95: 100, errorRate: 0, trust: 90, checks, filtered: 0 }]
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const report = { browser: browser.version(), source: root, mockData: true, routes: [] }
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== base) return route.abort()
    if (url.pathname.startsWith('/api/')) {
      const data = url.pathname === '/api/stats' ? stats : url.pathname === '/api/projects' ? { days: 30, projects }
        : url.pathname === '/api/live' ? { active: 1, events: [] } : url.pathname === '/api/seals' ? { seals: [], account: null } : { error: 'no fixture proof' }
      return route.fulfill({ status: url.pathname === '/api/proof' ? 404 : 200, contentType: 'application/json', body: JSON.stringify(data) })
    }
    return route.continue()
  })
  for (const path of ['/', '/demo', '/operator', '/p/stellarcope', '/docs']) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    await page.locator('main').first().waitFor()
    if (['/demo','/operator','/p/stellarcope'].includes(path)) await page.getByText('Stellarcope Lab', { exact: true }).first().waitFor()
    assert.ok((await page.locator('body').innerText()).length > 100)
    assert.deepEqual(errors, [], `${path}: ${errors.join('; ')}`)
    await page.screenshot({ path: fileURLToPath(new URL(`${path.replaceAll('/','_') || 'landing'}.png`, results)) })
    report.routes.push({ path, uncaughtErrors: errors.length, rendered: true })
    await page.close()
  }
  // Exercise the hooks' normal-motion branches as well as the reduced-motion routes.
  const motion = await context.newPage()
  await motion.emulateMedia({ reducedMotion: 'no-preference' })
  const motionErrors = []
  motion.on('pageerror', (error) => motionErrors.push(error.message))
  await motion.goto(base, { waitUntil: 'networkidle' })
  const counter = motion.locator('[data-count="99.99"]')
  const reveal = counter.locator('xpath=ancestor::*[@data-reveal][1]')
  assert.equal(await reveal.evaluate((el) => getComputedStyle(el).opacity), '0', 'normal-motion reveal must start hidden')
  await counter.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await motion.waitForFunction(() => {
    const value = Number(document.querySelector('[data-count="99.99"]').textContent)
    return value > 0 && value < 99.99
  }, null, { timeout: 5000 })
  await motion.waitForFunction(() => {
    const el = document.querySelector('[data-count="99.99"]')
    return el.textContent === '99.99' && getComputedStyle(el.closest('[data-reveal]')).opacity === '1'
  }, null, { timeout: 5000 })
  assert.deepEqual(motionErrors, [])
  report.motion = { path: '/', revealCompleted: true, intermediateCountObserved: true, countCompleted: true, uncaughtErrors: motionErrors.length }
  await motion.close()
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.message; throw error }
finally {
  await browser.close()
  await new Promise((r) => server.close(r))
  await writeFile(new URL('results.json', results), JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
}
