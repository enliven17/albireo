import { useEffect, useRef, useState } from 'react'

// Types mirror services/api/*. Every screen reads these live endpoints; there is no mock data.
export type Point = { date: string; value: number }
export type Share = { label: string; value: number; share: number }
export type Checks = { sep1: boolean; dns: boolean; meta: boolean; origin: boolean; sealed: boolean }

export type Stats = {
  tenant: { id: string; name: string; category: string | null; scf_round: number | null }
  days: number
  web: {
    visitors: Point[]; pageviewSeries: Point[]; total: number; pageviews: number; delta: number | null
    bounce: number | null; session: number; pages: Share[]; referrers: Share[]; countries: Share[]
    devices: Share[]; browsers: Share[]; events: Share[]
  }
  api: {
    requests: Point[]; latency: Point[]; total: number; errorRate: number | null; p50: number | null; p95: number | null
    status: Share[]; routes: (Share & { errors: number; p50: number | null; p95: number | null })[]
  }
  wallets: { funnel: { label: string; value: number }[]; share: Share[] }
  trust: { score: number; formula: string; checks: Checks; domains: { domain: string; method: string | null; verified: boolean }[]; filtered: number; drops: Share[] }
}

export type Live = { active: number; events: { ts: string; type: string; name: string | null; path: string; country: string | null; device: string; browser: string }[] }

export type Project = {
  id: string; name: string; category: string | null; scf_round: number | null
  visitors: number; pageviews: number; visitorSeries: Point[]; requests: number; p95: number | null; errorRate: number | null
  trust: number; checks: Checks; filtered: number
}

export type Proof = {
  day: string; summary: string; leaf: string; path: { hash: string; side: 'left' | 'right' }[]
  root: string; stored_root: string; tx_hash: string | null; account: string | null; horizon: string; data_key: string
}

export type Seal = { day: string; root: string; tx_hash: string | null; leaves: number; leaf: string }

/** fetches JSON, optionally polling; keeps the last good value while refreshing */
export function useApi<T>(url: string | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const current = useRef(url)

  useEffect(() => {
    current.current = url
    if (!url) return
    let alive = true
    let timer = 0
    setLoading(true)
    const load = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
        const body = (await res.json()) as T
        if (alive && current.current === url) { setData(body); setError(null) }
      } catch (err) {
        if (alive) setError((err as Error).message)
      } finally {
        if (alive) setLoading(false)
        if (alive && refreshMs) timer = window.setTimeout(load, refreshMs)
      }
    }
    void load()
    return () => { alive = false; clearTimeout(timer) }
  }, [url, refreshMs])

  return { data, error, loading }
}
