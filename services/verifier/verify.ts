import { resolveTxt } from 'node:dns/promises'

// Domain ownership checks. Each returns true only on positive proof; network errors and
// timeouts count as "not verified", never as success.

const TIMEOUT = 5000

async function fetchText(url: string) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), headers: { 'user-agent': 'AlbireoVerifier/1.0' } })
  if (!res.ok) return null
  const text = await res.text()
  return text.slice(0, 200_000)
}

/** SEP-1: the signing account must be listed in ACCOUNTS of the domain's stellar.toml */
export function tomlAccounts(toml: string) {
  const m = toml.match(/^\s*ACCOUNTS\s*=\s*\[([\s\S]*?)\]/m)
  return m ? [...m[1].matchAll(/"([GM][A-Z2-7]{55,68})"/g)].map((x) => x[1]) : []
}

export async function checkSep1(domain: string, account: string) {
  const toml = await fetchText(`https://${domain}/.well-known/stellar.toml`).catch(() => null)
  return !!toml && tomlAccounts(toml).includes(account)
}

export async function checkDns(domain: string, token: string) {
  try {
    const records = await resolveTxt(`_albireo.${domain}`)
    return records.some((chunks) => chunks.join('') === `albireo-verify=${token}`)
  } catch {
    return false
  }
}

export function metaToken(html: string) {
  const tag = html.match(/<meta[^>]+name=["']albireo-verify["'][^>]*>/i)?.[0]
  return tag?.match(/content=["']([^"']+)["']/i)?.[1] ?? null
}

export async function checkMeta(domain: string, token: string) {
  const html = await fetchText(`https://${domain}/`).catch(() => null)
  return !!html && metaToken(html) === token
}

export const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/
