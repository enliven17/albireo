import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DOMAIN_RE, metaToken, tomlAccounts } from './verify.ts'

const G = 'GDHDZ57XLMH3JGZJETKLT3JDMBEPU2HYB3YH7FRLJGXREZVVV4TEBKIS'

test('reads ACCOUNTS from stellar.toml, single and multi line', () => {
  assert.deepEqual(tomlAccounts(`VERSION="2.0.0"\nACCOUNTS=["${G}"]\n`), [G])
  assert.deepEqual(tomlAccounts(`ACCOUNTS = [\n  "${G}",\n  "bogus"\n]`), [G])
  assert.deepEqual(tomlAccounts('NETWORK_PASSPHRASE="x"'), [])
})

test('reads the albireo meta tag in either attribute order', () => {
  assert.equal(metaToken('<head><meta name="albireo-verify" content="abc123"></head>'), 'abc123')
  assert.equal(metaToken("<meta content='xyz' name='albireo-verify' />"), 'xyz')
  assert.equal(metaToken('<meta name="description" content="x">'), null)
})

test('domain validation', () => {
  assert.ok(DOMAIN_RE.test('albireo-theta.vercel.app'))
  assert.ok(!DOMAIN_RE.test('localhost'))
  assert.ok(!DOMAIN_RE.test('-bad.com'))
  assert.ok(!DOMAIN_RE.test('http://x.com'))
})
