import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withStellarcope } from './index.ts'

const PUBLIC = 'Public Global Stellar Network ; September 2015'

class FakeKit {
  selected = ''
  reject = false
  setWallet(id: string) { this.selected = id }
  openModal(p: { onWalletSelected: (o: { id: string }) => void }) { p.onWalletSelected({ id: 'xbull' }) }
  async getAddress() { return { address: 'GSECRETADDRESS' } }
  async signTransaction(xdr: string, _o: unknown) {
    if (this.reject) throw new Error('User rejected the request')
    return { signedTxXdr: `${xdr}:signed` }
  }
  version() { return 'fake' }
}

test('reports the funnel with wallet id and network only', async () => {
  const events: [string, Record<string, string>?][] = []
  const kit = withStellarcope(new FakeKit(), (n, p) => events.push([n, p]))

  kit.openModal({ onWalletSelected: () => {} })
  const addr = await kit.getAddress()
  const signed = await kit.signTransaction('AAAA', { networkPassphrase: PUBLIC })
  kit.reject = true
  await assert.rejects(kit.signTransaction('BBBB', { networkPassphrase: PUBLIC }))

  assert.equal(addr.address, 'GSECRETADDRESS')
  assert.equal(signed.signedTxXdr, 'AAAA:signed')
  assert.equal(kit.version(), 'fake')
  assert.deepEqual(events.map((e) => e[0]), ['wallet_modal_open', 'wallet_connected', 'tx_sign_requested', 'tx_signed', 'tx_sign_requested', 'tx_sign_rejected'])
  assert.deepEqual(events[3][1], { wallet_id: 'xbull', network: 'public' })
  assert.equal(events[5][1]?.reason, 'rejected')
  assert.ok(!JSON.stringify(events).includes('GSECRET'), 'never leaks an address')
  assert.ok(!JSON.stringify(events).includes('AAAA'), 'never leaks a transaction')
})

test('setWallet updates the reported wallet id', async () => {
  const events: [string, Record<string, string>?][] = []
  const kit = withStellarcope(new FakeKit(), (n, p) => events.push([n, p]))
  kit.setWallet('freighter')
  await kit.getAddress()
  assert.equal(kit.selected, 'freighter')
  assert.equal(events[0][1]?.wallet_id, 'freighter')
})
