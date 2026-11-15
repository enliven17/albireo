import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseWebEvent } from './web.ts'

const page = {
  version: 1,
  siteId: 'albireo',
  eventId: '9d94ec7c-b593-4632-9880-19d87b7a2875',
  type: 'pageview',
  path: '/swap',
}

await test('accepts the versioned pageview and custom-event contracts unchanged', () => {
  assert.deepEqual(parseWebEvent(page), page)
  const custom = { ...page, type: 'event', name: 'wallet.connected:success-v2' }
  assert.deepEqual(parseWebEvent(custom), custom)
  assert.deepEqual(parseWebEvent({ ...page, path: '/' }), { ...page, path: '/' })
})

await test('accepts bounded identifiers, paths and custom names at their limits', () => {
  const boundary = { ...page, siteId: 'a'.repeat(64), path: '/' + 'a'.repeat(255) }
  assert.deepEqual(parseWebEvent(boundary), boundary)
  const custom = { ...page, type: 'event', name: 'a'.repeat(64) }
  assert.deepEqual(parseWebEvent(custom), custom)
})

await test('rejects malformed versions, sites, UUIDs and discriminators', () => {
  for (const version of [undefined, 0, 2, '1'])
    assert.equal(parseWebEvent({ ...page, version }), null)
  for (const siteId of [undefined, '', 'a'.repeat(65), 'a b', 'a\n', 'ümlaut', 'a/b']) {
    assert.equal(parseWebEvent({ ...page, siteId }), null)
  }
  for (const eventId of [undefined, '', 'not-a-uuid', page.eventId + '\n']) {
    assert.equal(parseWebEvent({ ...page, eventId }), null)
  }
  for (const type of [undefined, 'click', 'PAGEVIEW'])
    assert.equal(parseWebEvent({ ...page, type }), null)
})

await test('rejects unsafe or oversized raw paths', () => {
  for (const path of [
    undefined,
    '',
    'swap',
    '//evil.invalid',
    '/a?secret=x',
    '/a#secret',
    '/a b',
    '/a\n',
    '/a\r',
    '/a\t',
    '/a\0',
    '/a\u007f',
    '/a\u00a0',
    '/' + 'a'.repeat(256),
  ]) {
    assert.equal(parseWebEvent({ ...page, path }), null, JSON.stringify(path))
  }
})

await test('requires a bounded event name and forbids names on pageviews', () => {
  assert.equal(parseWebEvent({ ...page, name: 'click' }), null)
  for (const name of [undefined, '', 'a'.repeat(65), 'has space', '1click', 'a\n', '<script>']) {
    assert.equal(parseWebEvent({ ...page, type: 'event', name }), null)
  }
})

await test('rejects client tenant authority, personal fields and all unknown properties', () => {
  for (const extra of [
    { tenantId: 'other' },
    { walletAddress: 'GSECRET' },
    { metadata: {} },
    { url: 'https://example.invalid' },
  ]) {
    assert.equal(parseWebEvent({ ...page, ...extra }), null)
    assert.equal(parseWebEvent({ ...page, type: 'event', name: 'click', ...extra }), null)
  }
})

await test('rejects non-object input without throwing', () => {
  for (const input of [null, undefined, false, 1, 'event', [], [page]])
    assert.equal(parseWebEvent(input), null)
})
