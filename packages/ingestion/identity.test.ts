import assert from 'node:assert/strict'
import { test } from 'node:test'
import { webReceiptId } from './identity.ts'

const eventId = '9d94ec7c-b593-4632-9880-19d87b7a2875'

await test('receipt identities are deterministic SHA-256 hexadecimal keys', () => {
  const id = webReceiptId('tenant-a', 'site-a', eventId)
  assert.match(id, /^[a-f0-9]{64}$/)
  assert.equal(webReceiptId('tenant-a', 'site-a', eventId), id)
})

await test('receipt identities are scoped by tenant, site and event', () => {
  const id = webReceiptId('tenant-a', 'site-a', eventId)
  assert.notEqual(webReceiptId('tenant-b', 'site-a', eventId), id)
  assert.notEqual(webReceiptId('tenant-a', 'site-b', eventId), id)
  assert.notEqual(webReceiptId('tenant-a', 'site-a', '9d94ec7c-b593-4632-9880-19d87b7a2876'), id)
})

await test('tuple encoding distinguishes concatenation-ambiguous context', () => {
  assert.notEqual(webReceiptId('ab', 'c', eventId), webReceiptId('a', 'bc', eventId))
})

await test('UUID letter casing does not produce duplicate receipt identities', () => {
  assert.equal(
    webReceiptId('tenant-a', 'site-a', eventId.toUpperCase()),
    webReceiptId('tenant-a', 'site-a', eventId),
  )
})

await test('invalid contexts and event IDs cannot acquire receipt keys', () => {
  for (const value of ['', 'a'.repeat(65), 'a b', 'a\n', 'a\0']) {
    assert.throws(() => webReceiptId(value, 'site-a', eventId), TypeError)
    assert.throws(() => webReceiptId('tenant-a', value, eventId), TypeError)
  }
  assert.throws(() => webReceiptId('tenant-a', 'site-a', 'bad-uuid'), TypeError)
})
