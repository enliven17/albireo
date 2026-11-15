// Private-schema adapter proof, not a stable public Umami API or production implementation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import pg from 'pg'
import { v5 } from 'uuid'
import { resolveCollectionSession } from '../upstream/collection-session.mjs'

type Prepared = {
  website: string
  eventKey: string
  sessionId: string
  visitId: string
  at: string
  path: string
  name: string | null
  props: Record<string, string>
}
const canonical = (value: unknown): unknown =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)]),
      )
    : value

async function store(pool: pg.Pool, event: Prepared, fail = false) {
  const client = await pool.connect()
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(canonical(event)))
    .digest('hex')
  const eventId = v5(`${event.website}:${event.eventKey}`, v5.DNS)
  try {
    await client.query('begin')
    const receipt = await client.query(
      'insert into albireo_lab_receipts values ($1,$2,$3) on conflict do nothing returning event_key',
      [event.website, event.eventKey, fingerprint],
    )
    if (!receipt.rowCount) {
      const prior = (
        await client.query(
          'select fingerprint from albireo_lab_receipts where website_id=$1 and event_key=$2',
          [event.website, event.eventKey],
        )
      ).rows[0]
      if (prior.fingerprint !== fingerprint)
        throw Object.assign(new Error('event ID conflict'), { status: 409 })
      await client.query('commit')
      return 'duplicate'
    }
    await client.query(
      'insert into session (session_id,website_id,created_at,browser,os,device,country) values ($1,$2,$3,$4,$5,$6,$7) on conflict (session_id) do nothing',
      [event.sessionId, event.website, event.at, 'chrome', 'Mac OS', 'desktop', 'TR'],
    )
    await client.query(
      'insert into website_event (event_id,website_id,session_id,visit_id,created_at,url_path,event_type,event_name,hostname) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        eventId,
        event.website,
        event.sessionId,
        event.visitId,
        event.at,
        event.path,
        event.name ? 2 : 1,
        event.name,
        'lab.invalid',
      ],
    )
    for (const [key, value] of Object.entries(event.props)) {
      await client.query(
        'insert into event_data (event_data_id,website_id,website_event_id,data_key,string_value,data_type,created_at) values ($1,$2,$3,$4,$5,1,$6)',
        [v5(`${eventId}:${key}`, v5.DNS), event.website, eventId, key, value, event.at],
      )
    }
    if (fail) throw new Error('injected failure after all effects')
    await client.query('commit')
    return 'applied'
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

test(
  'transactional adapter: real Umami schema, reports, concurrent retries, properties and rollback',
  { skip: !process.env.UMAMI_URL },
  async () => {
    process.env.APP_SECRET = 'disposable-upstream-identity-fixture'
    process.env.SALT_ROTATION = 'daily'
    process.env.TZ = 'UTC'
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6 })
    try {
      await pool.query(
        'create table albireo_lab_receipts (website_id uuid, event_key uuid, fingerprint text, primary key(website_id,event_key))',
      )
      const website = randomUUID()
      const user = (await pool.query('select user_id from "user" where username=$1', ['admin'])).rows[0]
        .user_id
      await pool.query('insert into website (website_id,name,domain,user_id) values ($1,$2,$3,$4)', [
        website,
        'Schema compatibility lab',
        'lab.invalid',
        user,
      ])
      const at = new Date(Date.now() - 60_000)
      const identity = resolveCollectionSession({
        sourceId: website,
        ip: '203.0.113.42',
        userAgent: 'lab-browser',
        createdAt: at,
      })
      const page: Prepared = {
        website,
        eventKey: randomUUID(),
        sessionId: identity.sessionId,
        visitId: identity.visitId,
        at: at.toISOString(),
        path: '/hello',
        name: null,
        props: {},
      }
      assert.equal(await store(pool, page), 'applied')
      // Models response lost after commit, followed by concurrent caller/worker replay.
      assert.ok(
        (await Promise.all(Array.from({ length: 8 }, () => store(pool, page)))).every(
          (r) => r === 'duplicate',
        ),
      )
      const custom: Prepared = {
        ...page,
        eventKey: randomUUID(),
        name: 'wallet_connected',
        props: { wallet_id: 'lab-wallet', network: 'testnet' },
      }
      await Promise.all(Array.from({ length: 8 }, () => store(pool, custom)))
      assert.equal(
        await store(pool, { ...custom, props: { network: 'testnet', wallet_id: 'lab-wallet' } }),
        'duplicate',
      )
      await assert.rejects(store(pool, { ...page, path: '/changed' }), { status: 409 })
      assert.equal(
        (await pool.query('select * from website_event where website_id=$1', [website])).rowCount,
        2,
      )
      assert.equal((await pool.query('select * from event_data where website_id=$1', [website])).rowCount, 2)
      const login = await fetch(`${process.env.UMAMI_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'umami' }),
      })
      assert.equal(login.status, 200, await login.clone().text())
      const auth = (await login.json()) as { token: string }
      const response = await fetch(
        `${process.env.UMAMI_URL}/api/websites/${website}/stats?startAt=${at.getTime() - 3600_000}&endAt=${at.getTime() + 3600_000}`,
        { headers: { authorization: `Bearer ${auth.token}` } },
      )
      const stats = (await response.json()) as {
        pageviews: number
        visitors: number
        visits: number
        bounces: number
      }
      assert.equal(response.status, 200, JSON.stringify(stats))
      assert.equal(stats.pageviews, 1)
      assert.equal(stats.visitors, 1)
      assert.equal(stats.visits, 1)
      assert.equal(stats.bounces, 0)
      const secondWebsite = randomUUID()
      await pool.query('insert into website (website_id,name,domain,user_id) values ($1,$2,$3,$4)', [
        secondWebsite,
        'Tenant B',
        'lab-b.invalid',
        user,
      ])
      await store(pool, { ...page, website: secondWebsite, sessionId: randomUUID(), visitId: randomUUID() })
      assert.equal(
        (
          await pool.query(
            'select count(distinct event_id)::int n from website_event where website_id=any($1)',
            [[website, secondWebsite]],
          )
        ).rows[0].n,
        3,
      )
      const rollback = { ...page, eventKey: randomUUID(), sessionId: randomUUID(), visitId: randomUUID() }
      await assert.rejects(store(pool, rollback, true), /injected failure/)
      assert.equal(
        (await pool.query('select * from session where session_id=$1', [rollback.sessionId])).rowCount,
        0,
      )
      assert.equal(
        (await pool.query('select * from albireo_lab_receipts where event_key=$1', [rollback.eventKey]))
          .rowCount,
        0,
      )
      assert.equal(await store(pool, rollback), 'applied')
      console.log(
        JSON.stringify({
          experiment: 'actual_umami_adapter',
          pageviews: stats.pageviews,
          visitors: stats.visitors,
          visits: stats.visits,
          bounces: stats.bounces,
          storedCustomProperties: 2,
          concurrentRetries: 8,
          rollbackAtomic: true,
          upstreamUiForkRequired: false,
        }),
      )
    } finally {
      await pool.end()
    }
  },
)
