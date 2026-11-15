import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCollectionSession } from '../upstream/collection-session.mjs'
import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  Account,
  Operation,
  WebAuth,
} from '@stellar/stellar-sdk'

test('actual pinned Umami resolver: repeat visits, identity drift, midnight, and delayed replay', (context) => {
  process.env.APP_SECRET = 'disposable-upstream-identity-fixture'
  process.env.SALT_ROTATION = 'daily'
  process.env.TZ = 'UTC'
  const now = Date.parse('2026-11-15T10:01:00Z')
  context.mock.timers.enable({ apis: ['Date'], now })
  const input = {
    sourceId: 'lab-website',
    ip: '203.0.113.42',
    userAgent: 'synthetic-browser',
    createdAt: new Date(now),
  }
  const first = resolveCollectionSession(input)
  assert.deepEqual(resolveCollectionSession(input), first)
  const cached = { websiteId: 'lab-website', ...first }
  context.mock.timers.setTime(now + 5 * 60_000)
  assert.equal(
    resolveCollectionSession({ ...input, createdAt: new Date(), cache: cached }).visitId,
    first.visitId,
  )
  assert.notEqual(
    resolveCollectionSession({ ...input, ip: '203.0.113.43', cache: cached }).sessionId,
    first.sessionId,
  )
  context.mock.timers.setTime(now + 6 * 60 * 60_000)
  const delayed = resolveCollectionSession({ ...input, cache: cached, historical: true })
  assert.equal(delayed.sessionId, first.sessionId)
  assert.equal(delayed.visitId, first.visitId)
  assert.notEqual(
    resolveCollectionSession({ ...input, ip: '10.0.0.5', historical: true }).sessionId,
    first.sessionId,
  )
  const before = resolveCollectionSession({ ...input, createdAt: new Date('2026-11-15T23:59:00Z') })
  const after = resolveCollectionSession({
    ...input,
    createdAt: new Date('2026-11-16T00:01:00Z'),
    cache: { websiteId: 'lab-website', ...before },
  })
  assert.notEqual(before.sessionId, after.sessionId)
  // Record actual upstream expiry behavior rather than assuming a generic session definition.
  context.mock.timers.setTime(now + 31 * 60_000)
  const idle = resolveCollectionSession({ ...input, createdAt: new Date(), cache: cached })
  assert.equal(idle.iat, Math.floor(Date.now() / 1000))
  console.log(
    JSON.stringify({
      experiment: 'umami_identity',
      repeatStable: true,
      delayedOriginalContextStable: true,
      workerIpChangesIdentity: true,
      midnightRotates: true,
      idleSameHourVisitIdReused: idle.visitId === first.visitId,
    }),
  )
})

test('Stellar SDK 17.4: SEP-10 and summary transaction sign/verify without a network', () => {
  const server = Keypair.random()
  const client = Keypair.random()
  const challenge = WebAuth.buildChallengeTx(
    server,
    client.publicKey(),
    'lab.example',
    300,
    Networks.TESTNET,
    'auth.lab.example',
  )
  const tx = new Transaction(challenge, Networks.TESTNET)
  tx.sign(client)
  assert.deepEqual(
    WebAuth.verifyChallengeTxSigners(
      tx.toXDR(),
      server.publicKey(),
      Networks.TESTNET,
      [client.publicKey()],
      ['lab.example'],
      'auth.lab.example',
    ),
    [client.publicKey()],
  )
  assert.throws(() =>
    WebAuth.verifyChallengeTxSigners(
      tx.toXDR(),
      server.publicKey(),
      Networks.TESTNET,
      [client.publicKey()],
      ['other.example'],
      'auth.lab.example',
    ),
  )
  const summary = new TransactionBuilder(new Account(client.publicKey(), '1'), {
    fee: '1000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: 'albireo:2026-11-15', value: Buffer.alloc(32, 1) }))
    .setTimeout(120)
    .build()
  summary.sign(client)
  assert.equal(client.verify(summary.hash(), summary.signatures[0]!.signature), true)
})
