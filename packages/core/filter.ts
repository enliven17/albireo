// Inflation filter for web events. Each check returns a reason; the first reason found
// decides the drop. Dropped events are counted per reason, never silently discarded.

export type DropReason = 'origin' | 'bot' | 'headless' | 'datacenter' | 'rate' | 'referrer_spam'

// ponytail: compact crawler pattern; swap for the isbot list if misses show up in the filter stats
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|quora link|outbrain|pinterest|vkshare|w3c_validator|lighthouse|pagespeed|headlesschrome|phantomjs|puppeteer|playwright|selenium|curl\/|wget\/|python-requests|httpclient|go-http-client|node-fetch|axios\/|okhttp|java\/|libwww|scrapy|monitor|uptime|preview/i

const SPAM_REFERRERS = new Set(['semalt.com', 'buttons-for-website.com', 'darodar.com', 'ilovevitaly.com', 'priceg.com'])

export type EventSignals = {
  hostname: string
  origin?: string | null
  userAgent?: string | null
  webdriver?: boolean
  screen?: { w: number; h: number }
  referrer?: string | null
  asnClass?: 'datacenter' | 'residential' | 'mobile' | 'unknown'
}

/** a hostname is allowed when it equals a verified domain or is a subdomain of one */
export function hostAllowed(hostname: string, verified: string[]) {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  return verified.some((d) => h === d || h.endsWith(`.${d}`))
}

export function dropReason(e: EventSignals, verified: string[]): DropReason | null {
  if (!hostAllowed(e.hostname, verified)) return 'origin'
  if (e.origin) {
    try {
      if (!hostAllowed(new URL(e.origin).hostname, verified)) return 'origin'
    } catch {
      return 'origin'
    }
  }
  if (!e.userAgent || BOT_UA.test(e.userAgent)) return 'bot'
  if (e.webdriver) return 'headless'
  if (e.screen && (e.screen.w < 120 || e.screen.h < 120 || e.screen.w > 16384 || e.screen.h > 16384)) return 'headless'
  if (e.asnClass === 'datacenter') return 'datacenter'
  if (e.referrer) {
    try {
      const host = new URL(e.referrer).hostname.replace(/^www\./, '')
      if (SPAM_REFERRERS.has(host)) return 'referrer_spam'
    } catch { /* malformed referrer is ignored, not fatal */ }
  }
  return null
}

/** token bucket per key, refilled continuously */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>()
  private rate: number
  private burst: number
  constructor(perMinute = 120, burst = 30) {
    this.rate = perMinute / 60_000
    this.burst = burst
  }
  take(key: string, now = Date.now()) {
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now }
    b.tokens = Math.min(this.burst, b.tokens + (now - b.at) * this.rate)
    b.at = now
    const ok = b.tokens >= 1
    if (ok) b.tokens -= 1
    this.buckets.set(key, b)
    // ponytail: drop idle buckets lazily once the map grows; an LRU is the upgrade if memory matters
    if (this.buckets.size > 100_000) for (const [k, v] of this.buckets) if (now - v.at > 120_000) this.buckets.delete(k)
    return ok
  }
}
