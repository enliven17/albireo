import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { runner } from 'node-pg-migrate'
import { checkpoint, percentile, type HistogramPoint } from './histogram.ts'
import { fileURLToPath } from 'node:url'

test(
  'versioned SQL migration and durable cumulative histogram vectors',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const databaseUrl = process.env.DATABASE_URL!
    const options = {
      databaseUrl,
      dir: fileURLToPath(new URL('../migrations/', import.meta.url)),
      migrationsTable: 'lab_migrations',
      direction: 'up' as const,
      log: () => {},
    }
    assert.equal((await runner(options)).length, 1)
    assert.equal((await runner(options)).length, 0)
    let pool = new pg.Pool({ connectionString: databaseUrl, max: 6 })
    const point: HistogramPoint = {
      tenant: 'a',
      instance: 'one',
      start: '1',
      end: '2',
      bounds: [0.1, 1],
      buckets: ['50', '40', '10'],
      count: '100',
      sum: 90,
    }
    try {
      await checkpoint(pool, point, 'known-zero')
      await checkpoint(
        pool,
        { ...point, end: '3', count: '150', sum: 110, buckets: ['80', '55', '15'] },
        'known-zero',
      )
      await pool.end()
      pool = new pg.Pool({ connectionString: databaseUrl, max: 6 })
      const final = { ...point, end: '6', count: '200', sum: 130, buckets: ['100', '80', '20'] }
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => checkpoint(pool, final, 'known-zero')),
      )
      assert.equal(concurrent.filter((r) => r === 'applied').length, 1)
      const result = (
        await pool.query('select count,total_sum,buckets from lab_hist_rollup where tenant=$1', ['a'])
      ).rows[0]
      assert.deepEqual(result, { count: '200', total_sum: 130, buckets: ['100', '80', '20'] })
      await assert.rejects(checkpoint(pool, { ...final, sum: 131 }, 'known-zero'), { status: 409 })
      await assert.rejects(checkpoint(pool, { ...final, end: '7', bounds: [0.2, 1] }, 'known-zero'), {
        status: 422,
      })
      await assert.rejects(
        checkpoint(pool, { ...final, end: '7', count: '10', sum: 5, buckets: ['5', '4', '1'] }, 'known-zero'),
        { status: 422 },
      )
      await assert.rejects(
        checkpoint(pool, { ...final, end: '5', count: '180', buckets: ['90', '75', '15'] }, 'known-zero'),
        { status: 422 },
      )
      await assert.rejects(checkpoint(pool, { ...final, end: '0' }, 'known-zero'), { status: 400 })
      const another = { ...point, instance: 'two', count: '40', sum: 20, buckets: ['20', '15', '5'] }
      await checkpoint(pool, another, 'known-zero')
      await checkpoint(
        pool,
        { ...point, start: '10', end: '11', count: '10', sum: 5, buckets: ['5', '4', '1'] },
        'known-zero',
      )
      const total = (await pool.query('select count from lab_hist_rollup where tenant=$1', ['a'])).rows[0]
      assert.equal(total.count, '250')
      const rollback = { ...point, tenant: 'rollback' }
      await assert.rejects(checkpoint(pool, rollback, 'known-zero', true), /injected/)
      assert.equal((await pool.query("select * from lab_hist_rollup where tenant='rollback'")).rowCount, 0)
      await checkpoint(pool, rollback, 'known-zero')
      assert.equal(
        (await pool.query("select count from lab_hist_rollup where tenant='rollback'")).rows[0].count,
        '100',
      )
      assert.equal(await checkpoint(pool, { ...point, tenant: 'unknown-start' }, 'baseline'), 'baseline')
      await checkpoint(
        pool,
        { ...point, tenant: 'unknown-start', end: '3', count: '150', sum: 110, buckets: ['80', '55', '15'] },
        'baseline',
      )
      assert.equal(
        (await pool.query("select count from lab_hist_rollup where tenant='unknown-start'")).rows[0].count,
        '50',
      )
      const huge = '9007199254740993'
      await checkpoint(
        pool,
        { ...point, tenant: 'large', count: huge, buckets: [huge, '0', '0'], sum: 1 },
        'known-zero',
      )
      assert.equal(
        (await pool.query("select count from lab_hist_rollup where tenant='large'")).rows[0].count,
        huge,
      )
      // Standard queues can reorder deliveries: immutable source points permit repair.
      await pool.query(
        'create table lab_ordered_points (ending bigint primary key, count bigint, buckets bigint[])',
      )
      await pool.query(
        'insert into lab_ordered_points values (2,100,ARRAY[50,40,10]),(6,200,ARRAY[100,80,20])',
      )
      await pool.query('insert into lab_ordered_points values (3,150,ARRAY[80,55,15]) on conflict do nothing')
      await pool.query('insert into lab_ordered_points values (3,150,ARRAY[80,55,15]) on conflict do nothing')
      const repaired = await pool.query(`with counts as (
        select ending,count-lag(count,1,0::bigint) over(order by ending) as delta from lab_ordered_points
      ), bins as (
        select ending,n,b-lag(b,1,0::bigint) over(partition by n order by ending) as delta
        from lab_ordered_points cross join lateral unnest(buckets) with ordinality as u(b,n)
      ) select counts.ending::text,counts.delta::text,array_agg(bins.delta::text order by n) buckets
        from counts join bins using(ending) group by counts.ending,counts.delta order by counts.ending`)
      assert.deepEqual(repaired.rows, [
        { ending: '2', delta: '100', buckets: ['50', '40', '10'] },
        { ending: '3', delta: '50', buckets: ['30', '15', '5'] },
        { ending: '6', delta: '50', buckets: ['20', '25', '5'] },
      ])
      console.log(
        JSON.stringify({
          experiment: 'durable_histograms',
          restartTotal: 200,
          mergedInstancesAndEpochs: 250,
          concurrentWriters: 8,
          initialUnknownCountsOnlyLaterDelta: 50,
          largeCountRoundTrip: huge,
          outOfOrderRepairedFromImmutablePoints: true,
        }),
      )
    } finally {
      await pool.end()
    }
  },
)

test('unbounded histogram percentiles and incompatible layouts are explicit', () => {
  assert.deepEqual(percentile([10], [0n, 1n], 0.95), { estimate: null, lowerBound: 10 })
  assert.equal(percentile([1, 2], [1n, 1n, 0n], 0.5)?.estimate, 1)
  assert.equal(percentile([1], [0n, 0n], 0.95), null)
  assert.equal(percentile([1], [9007199254740993n, 0n], 0.95)?.estimate, null)
})
