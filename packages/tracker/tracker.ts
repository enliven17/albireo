// Albireo web tracker. Cookieless: nothing is written to the device, no identifiers are
// created here. The collector derives a daily visitor hash server side.

export type Props = Record<string, string | number | boolean>
export type Options = { site: string; endpoint: string; respectDnt?: boolean }

type Payload = {
  site: string
  type: 'pageview' | 'event'
  name?: string
  props?: Props
  path: string
  hostname: string
  referrer?: string
  utm?: Record<string, string>
  screen: { w: number; h: number }
  lang: string
  webdriver: boolean
}

const UTM = ['utm_source', 'utm_medium', 'utm_campaign']
let opts: Options | null = null
let lastPath = ''

function blocked() {
  if (!opts) return true
  if (!opts.respectDnt) return false
  const n = navigator as Navigator & { globalPrivacyControl?: boolean }
  return n.doNotTrack === '1' || n.globalPrivacyControl === true
}

function send(p: Payload) {
  const body = JSON.stringify(p)
  // text/plain keeps the request simple, so no CORS preflight
  if (navigator.sendBeacon?.(opts!.endpoint, new Blob([body], { type: 'text/plain' }))) return
  fetch(opts!.endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {})
}

function base(type: Payload['type']): Payload {
  const url = new URL(location.href)
  const utm: Record<string, string> = {}
  for (const k of UTM) {
    const v = url.searchParams.get(k)
    if (v) utm[k.slice(4)] = v.slice(0, 100)
  }
  let referrer: string | undefined
  if (document.referrer) {
    try {
      const r = new URL(document.referrer)
      if (r.hostname !== location.hostname) referrer = r.origin
    } catch { /* ignore malformed referrer */ }
  }
  return {
    site: opts!.site,
    type,
    path: url.pathname,
    hostname: location.hostname,
    referrer,
    utm: Object.keys(utm).length ? utm : undefined,
    screen: { w: screen.width, h: screen.height },
    lang: navigator.language,
    webdriver: navigator.webdriver === true,
  }
}

export function pageview() {
  if (blocked()) return
  const path = location.pathname
  if (path === lastPath) return
  lastPath = path
  send(base('pageview'))
}

export function track(name: string, props?: Props) {
  if (blocked() || !name) return
  send({ ...base('event'), name: name.slice(0, 64), props })
}

/** starts page view tracking, single page app navigations included */
export function init(o: Options) {
  if (opts) return
  opts = o
  const wrap = (key: 'pushState' | 'replaceState') => {
    const original = history[key]
    history[key] = function (this: History, ...args: Parameters<History['pushState']>) {
      const r = original.apply(this, args)
      queueMicrotask(pageview)
      return r
    }
  }
  wrap('pushState')
  wrap('replaceState')
  addEventListener('popstate', pageview)
  if (document.readyState === 'complete') pageview()
  else addEventListener('load', pageview, { once: true })
}
