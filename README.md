# Digital Auction Engine

Backend system that replicates the mechanics of **Telegram Gift Auctions** for digital goods:
- multi-round auction flow
- bidding + ranking per round
- anti-sniping (round end extensions)
- balance management with reservation + ledger
- settlement (winners, refunds, state transitions)
- minimal demo UI
- load testing

**Stack:** Node.js, TypeScript, MongoDB (+ Redis/BullMQ for scheduled jobs), pnpm, Docker.

## Goals
- **Correctness under concurrency**: no double-spend, no negative balances, idempotent settlement.
- **Reproducible run**: one-command local start via Docker.
- **Observable + testable**: clear logs/metrics, tests for race conditions, k6 load scripts.

## Key assumptions
- Auction consists of **rounds**. Each round has an end time and allocation rules (how many winners/items are selected).
- Users place bids during an active round. Ranking determines winners for that round.
- **Anti-sniping**: if a bid arrives within `snipingWindowSec` before round end, the round end extends by `extensionSec` up to `maxExtensions`.
- Balance model: `available / reserved`. Funds required for an active bid are reserved; outbid users get released; winners are captured at settlement.
- All money movements are recorded in an append-only **ledger**.

## Architecture
- `apps/api`: REST API + SSE events
- `apps/worker`: BullMQ workers (round close / settlement / transitions)
- MongoDB **replica set** for transactions
- Redis for job queue and scheduling

## Collections (MVP)
- `auctions`
- `rounds`
- `bids`
- `wallets`
- `ledger_entries`

## Invariants
- `wallet.available >= 0`
- `wallet.reserved >= 0`
- settlement is **idempotent**
- state transitions are atomic (Mongo transactions)

## Local run
```bash
cd infra
docker compose up -d
