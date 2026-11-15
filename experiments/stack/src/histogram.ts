// Normalized explicit-histogram pattern fixture; not an OTLP decoder.
import { createHash } from 'node:crypto'
import type { Pool } from 'pg'

export type HistogramPoint = {
  tenant: string
  instance: string
  start: string
  end: string
  bounds: number[]
  buckets: string[]
  count: string
  sum: number
}
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
const fault = (status: number, message: string) => Object.assign(new Error(message), { status })
export async function checkpoint(
  pool: Pool,
  point: HistogramPoint,
  initial: 'known-zero' | 'baseline',
  failBeforeCommit = false,
) {
  const { tenant, instance, start, end, bounds, buckets, count, sum } = point
  if (
    !/^\d+$/.test(count) ||
    !/^\d+$/.test(start) ||
    !/^\d+$/.test(end) ||
    BigInt(end) <= BigInt(start) ||
    buckets.length !== bounds.length + 1 ||
    buckets.some((v) => !/^\d+$/.test(v)) ||
    bounds.some((v, i) => !Number.isFinite(v) || v < 0 || (i > 0 && v <= bounds[i - 1]!)) ||
    buckets.reduce((a, v) => a + BigInt(v), 0n) !== BigInt(count) ||
    !Number.isFinite(sum) ||
    sum < 0
  )
    throw fault(400, 'invalid histogram')
  const stream = hash({ tenant, instance, start, metric: 'http.server.request.duration', unit: 's' })
  const receipt = hash({ stream, end })
  const fingerprint = hash(point)
  const client = await pool.connect()
  try {
    await client.query('begin')
    // Inserting/locking the stream serializes concurrent first points and retries.
    const created = await client.query(
      'insert into lab_hist_stream values ($1,0,0,0,$2,$3) on conflict do nothing returning id',
      [stream, JSON.stringify(buckets.map(() => '0')), JSON.stringify(bounds)],
    )
    const previous = (
      await client.query<{
        ending: string
        count: string
        total_sum: number
        buckets: string[]
        bounds: number[]
      }>('select * from lab_hist_stream where id=$1 for update', [stream])
    ).rows[0]!
    const prior = (
      await client.query<{ fingerprint: string }>('select fingerprint from lab_hist_receipt where id=$1', [
        receipt,
      ])
    ).rows[0]
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw fault(409, 'point content conflict')
      await client.query('commit')
      return 'duplicate'
    }
    if (JSON.stringify(previous.bounds) !== JSON.stringify(bounds))
      throw fault(422, 'layout changed without new epoch')
    if (BigInt(end) <= BigInt(previous.ending)) throw fault(422, 'unseen out-of-order point')
    const delta = buckets.map((v, i) => BigInt(v) - BigInt(previous.buckets[i]!))
    const countDelta = BigInt(count) - BigInt(previous.count)
    const sumDelta = sum - previous.total_sum
    if (countDelta < 0n || delta.some((v) => v < 0n) || sumDelta < -1e-9)
      throw fault(422, 'reset without new start time')
    const baseline = created.rowCount === 1 && initial === 'baseline'
    const layout = hash(bounds)
    if (!baseline) {
      await client.query(
        `insert into lab_hist_rollup values ($1,$2,$3,$4,$5)
        on conflict (tenant,layout) do update set count=lab_hist_rollup.count+excluded.count,
        total_sum=lab_hist_rollup.total_sum+excluded.total_sum,
        buckets=(select jsonb_agg((a.value::bigint+b.value::bigint)::text order by a.ordinality)
          from jsonb_array_elements_text(lab_hist_rollup.buckets) with ordinality a
          join jsonb_array_elements_text(excluded.buckets) with ordinality b using (ordinality))`,
        [tenant, layout, countDelta.toString(), Math.max(0, sumDelta), JSON.stringify(delta.map(String))],
      )
    }
    await client.query('update lab_hist_stream set ending=$2,count=$3,total_sum=$4,buckets=$5 where id=$1', [
      stream,
      end,
      count,
      sum,
      JSON.stringify(buckets),
    ])
    await client.query('insert into lab_hist_receipt values ($1,$2)', [receipt, fingerprint])
    if (failBeforeCommit) throw new Error('injected transaction failure')
    await client.query('commit')
    return baseline ? 'baseline' : 'applied'
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export function percentile(bounds: number[], buckets: bigint[], q: number) {
  const total = buckets.reduce((a, b) => a + b, 0n)
  // Only reporting converts counts to numbers; refuse false precision above safe integer.
  if (total === 0n) return null
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    return { estimate: null, reason: 'count exceeds reporting precision' }
  const rank = Number(total) * q
  let seen = 0
  for (let i = 0; i < buckets.length; i++) {
    const count = Number(buckets[i]!)
    if (seen + count >= rank && count > 0) {
      const lower = i === 0 ? 0 : bounds[i - 1]!
      const upper = bounds[i]
      return upper === undefined
        ? { estimate: null, lowerBound: lower }
        : {
            estimate: lower + ((rank - seen) / count) * (upper - lower),
            lowerBound: lower,
            upperBound: upper,
          }
    }
    seen += count
  }
  return null
}
