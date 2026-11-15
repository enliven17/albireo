import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import * as sdk from '@stellar/stellar-sdk'
import { anchor, HORIZON } from './seal.ts'
import type { Sql } from '../shared/db.ts'

await test('anchor preserves the signed Stellar root and retries failed submissions', async (t) => {
  const db = new PGlite()
  const sql = db as unknown as Sql
  await sql.query('create table seals (day text primary key, root text, tx_hash text)')
  const day = '2026-11-15'
  const root = 'ab'.repeat(32)
  const key = sdk.Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7))
  await sql.query('insert into seals values ($1,$2,null)', [day, root])
  const network = HORIZON.includes('testnet') ? sdk.Networks.TESTNET : sdk.Networks.PUBLIC
  const account = t.mock.method(sdk.Horizon.Server.prototype, 'loadAccount', async () =>
    new sdk.Account(key.publicKey(), '1'))
  let fail = true
  const submit = t.mock.method(sdk.Horizon.Server.prototype, 'submitTransaction', async (value: sdk.Transaction | sdk.FeeBumpTransaction) => {
    const tx = new sdk.Transaction(value.toXDR(), network)
    assert.equal(tx.source, key.publicKey())
    assert.equal(tx.fee, '1000')
    assert.equal(tx.memo.type, 'text')
    const memo = tx.memo.value
    assert.ok(memo instanceof Uint8Array)
    assert.equal(Buffer.from(memo).toString('utf8'), `albireo seal ${day}`)
    assert.equal(tx.operations.length, 1)
    const operation = tx.operations[0]!
    assert.equal(operation.type, 'manageData')
    assert.equal(operation.name, `albireo:${day}`)
    assert.deepEqual(Buffer.from(operation.value!), Buffer.from(root, 'hex'))
    assert.equal(key.verify(tx.hash(), tx.signatures[0]!.signature), true)
    assert.ok(Number(tx.timeBounds!.maxTime) >= Math.floor(Date.now() / 1000))
    if (fail) throw new Error('synthetic submission failure')
    return { hash: 'confirmed-test-hash' } as sdk.Horizon.HorizonApi.SubmitTransactionResponse
  })
  try {
    await assert.rejects(anchor(sql, day, key.secret()), /synthetic submission failure/)
    assert.equal((await sql.query('select tx_hash from seals')).rows[0].tx_hash, null)
    fail = false
    assert.equal(await anchor(sql, day, key.secret()), 'confirmed-test-hash')
    assert.equal(await anchor(sql, day, key.secret()), 'confirmed-test-hash')
    assert.equal(submit.mock.callCount(), 2)
    assert.equal(account.mock.callCount(), 2)
  } finally {
    await db.close()
  }
})
