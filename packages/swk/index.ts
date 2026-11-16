// Stellar Wallets Kit funnel for Stellarcope. Wraps a kit instance and reports the four steps
// of the signing funnel. Only the wallet id and the network are sent, never an address,
// a transaction or an amount.

type Track = (name: string, props?: Record<string, string>) => void
type AnyKit = Record<string, unknown>

const NETWORKS: Record<string, string> = {
  'Public Global Stellar Network ; September 2015': 'public',
  'Test SDF Network ; September 2015': 'testnet',
  'Test SDF Future Network ; October 2022': 'futurenet',
}

const network = (opts: unknown) => {
  const pass = (opts as { networkPassphrase?: string } | undefined)?.networkPassphrase
  return pass ? NETWORKS[pass] ?? 'custom' : 'unknown'
}

const failure = (err: unknown) => {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase()
  if (/reject|denied|declin|cancel/.test(msg)) return 'rejected'
  if (/not installed|not available|no wallet/.test(msg)) return 'unavailable'
  return 'error'
}

export function withStellarcope<K extends object>(kit: K, track: Track): K {
  let walletId = 'unknown'
  const k = kit as unknown as AnyKit
  const call = (name: string, args: unknown[]) => (k[name] as (...a: unknown[]) => unknown).apply(kit, args)

  const handlers: Record<string, (args: unknown[]) => unknown> = {
    setWallet: (args) => {
      walletId = String(args[0] ?? 'unknown')
      return call('setWallet', args)
    },
    openModal: (args) => {
      track('wallet_modal_open')
      const params = (args[0] ?? {}) as { onWalletSelected?: (o: { id?: string }) => unknown }
      const picked = params.onWalletSelected
      const next = picked
        ? { ...params, onWalletSelected: (o: { id?: string }) => { walletId = o?.id ?? walletId; return picked(o) } }
        : params
      return call('openModal', [next, ...args.slice(1)])
    },
    getAddress: async (args) => {
      try {
        const r = await call('getAddress', args)
        track('wallet_connected', { wallet_id: walletId, network: network(args[0]) })
        return r
      } catch (err) {
        track('wallet_connect_failed', { wallet_id: walletId, reason: failure(err) })
        throw err
      }
    },
    signTransaction: async (args) => {
      const net = network(args[1])
      track('tx_sign_requested', { wallet_id: walletId, network: net })
      try {
        const r = await call('signTransaction', args)
        track('tx_signed', { wallet_id: walletId, network: net })
        return r
      } catch (err) {
        track('tx_sign_rejected', { wallet_id: walletId, network: net, reason: failure(err) })
        throw err
      }
    },
  }

  return new Proxy(kit, {
    get(target, prop, receiver) {
      const handler = typeof prop === 'string' ? handlers[prop] : undefined
      if (handler && typeof (target as AnyKit)[prop as string] === 'function') return (...args: unknown[]) => handler(args)
      return Reflect.get(target, prop, receiver)
    },
  })
}
