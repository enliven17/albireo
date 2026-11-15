<p align="center"><img src="brand/logo/lockup-color.png" alt="Albireo" width="360"></p>

<p align="center">Trusted, privacy-first web and API analytics for the Stellar ecosystem.</p>

<p align="center"><img src="brand/social/og.png" alt="Every number, verified." width="720"></p>

Albireo is our response to the Stellar Community Fund RFP **Web and API Analytics for Stellar Ecosystem Projects**. SCF reviewers rely on self reported usage today. Albireo gives every Stellar project free, cookieless web and API analytics, collected only from domains the project has proven it owns, filtered for bots, and sealed on Stellar once a day so anyone can check a number was never edited.

Albireo is a double star: one point of light to the naked eye, a gold and a blue star through a telescope. One platform, two layers. Gold is web, blue is API.

## What it does

| | |
|---|---|
| **Web analytics** | Page views, unique visitors, referrers, session duration, bounce rate, country, device and browser. Custom events and an automatic Stellar Wallets Kit funnel. Umami core. |
| **API analytics** | Projects dual export OpenTelemetry. Albireo keeps counters and histograms only: volume per normalized route, status codes, p50 and p95, for 24 months. |
| **Stellar native enrollment** | Wallet sign in through SEP-10, domain proof through SEP-1 `stellar.toml`, DNS or a meta tag. Events from unverified origins are refused. |
| **Daily onchain seal** | Each project summary becomes a SHA-256 leaf, one Merkle root per day is written with `manage_data`, inclusion proofs are public. |
| **Inflation resistance** | Origin binding, bot lists, datacenter networks, headless signals, rate limits and anomaly detection, rolled into an open trust score. |
| **Privacy** | No cookies, no IP addresses, no wallet addresses. EU data residency and one click erasure with a signed receipt. |


## Live

Albireo measures itself. The site at [albireo-theta.vercel.app](https://albireo-theta.vercel.app) runs the tracker, its API records its own request metrics, and a daily cron seals every tenant summary on Stellar testnet. The [dashboard](https://albireo-theta.vercel.app/demo), [operator view](https://albireo-theta.vercel.app/operator) and [public card](https://albireo-theta.vercel.app/p/albireo) read only live data. Documentation lives at [/docs](https://albireo-theta.vercel.app/docs).

## Repository

```
packages/core      normalization, inflation filter, visitor hashing, Merkle seals, histograms
packages/tracker   1.5 KB cookieless web tracker, immutable versioned builds with SRI
packages/swk       Stellar Wallets Kit funnel wrapper, never sends an address
services/collector web ingestion with a durable spool
services/writer    spool to Postgres
services/api       stats queries, seals and proofs
services/verifier  SEP-1, DNS and meta domain verification
api/               Vercel functions: /e, stats, live, projects, seals, proof, daily seal cron
db/schema.sql      Postgres schema
src/               landing, dashboards and docs (Vite, React, GSAP, Lenis)
brand/             logo, brand kit boards, social card
```

## Run

```bash
npm install
npm test          # unit and integration tests, Postgres via PGlite
npm run dev       # http://localhost:5173, reads live data from production
npm run build
npm run seed      # enroll and verify the albireo tenant (needs .env.local)
```

Environment variables are listed in the [self hosting docs](https://albireo-theta.vercel.app/docs/self-hosting).

Technical investigation, current stack research, the architecture proposal, and the local reliability experiment are indexed in [engineering](engineering/README.md). These documents distinguish the prototype's current behavior from proposed production capabilities.

## License

MIT
