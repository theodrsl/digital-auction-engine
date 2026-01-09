/**
 * Load test for Digital Auction Engine
 *
 * Requirements:
 * - API running at BASE_URL (default http://localhost:3000)
 * - Mongo reachable (default mongodb://127.0.0.1:27017/digital_auction)
 *
 * What it does:
 * 1) Credits wallets for u1..uN (AVAILABLE += creditAmount) + ledger CREDIT entry
 * 2) Creates auction (roundDurationSec)
 * 3) Sends M bids concurrently (POST /bids), always increasing per-user amount
 * 4) Waits for round CLOSE + allocations SETTLED
 * 5) Validates: reserved == 0 for all users; no duplicate settle:* ledger keys
 */

const mongoose = require('mongoose');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/digital_auction';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpJson(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = typeof json === 'object' ? JSON.stringify(json) : String(json);
    const err = new Error(`HTTP ${res.status} ${method} ${path}: ${msg}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function parseArgs() {
  // node load-test.js --users 100 --bids 2000 --concurrency 50 --duration 30 --winners 10 --credit 100000
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = args[i + 1];
    out[key] = val;
    i++;
  }
  const users = Number(out.users ?? 100);
  const bids = Number(out.bids ?? 2000);
  const concurrency = Number(out.concurrency ?? 50);
  const duration = Number(out.duration ?? 30);
  const winners = Number(out.winners ?? 10);
  const credit = Number(out.credit ?? 100000);

  if (!Number.isFinite(users) || users < 1) throw new Error('bad --users');
  if (!Number.isFinite(bids) || bids < 1) throw new Error('bad --bids');
  if (!Number.isFinite(concurrency) || concurrency < 1) throw new Error('bad --concurrency');
  if (!Number.isFinite(duration) || duration < 5) throw new Error('bad --duration (min 5 sec)');
  if (!Number.isFinite(winners) || winners < 1) throw new Error('bad --winners');
  if (!Number.isFinite(credit) || credit <= 0) throw new Error('bad --credit');

  return { users, bids, concurrency, duration, winners, credit };
}

async function creditUsers(db, { users, credit }) {
  const wallets = db.collection('wallets');
  const ledger = db.collection('ledger_entries');

  const currency = 'TON';

  for (let i = 1; i <= users; i++) {
    const userId = `u${i}`;
    const now = new Date();

    // 1) ledger CREDIT (unique)
    const entryKey = `load:credit:${userId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    await ledger.insertOne({
      entryKey,
      userId,
      currency,
      type: 'CREDIT',
      amount: credit,
      from: 'EXTERNAL',
      to: 'AVAILABLE',
      createdAt: now,
    });

    // 2) wallet upsert + inc available (NO conflict)
    await wallets.updateOne(
    { userId, currency },
    {
        $setOnInsert: {
        userId,
        currency,
        reserved: 0,
        createdAt: now,
        },
        $inc: { available: credit, version: 1 },
        $set: { updatedAt: now },
    },
    { upsert: true },
    );
  }

  return { currency };
}


async function runBids({ auctionId, roundId, users, bids, concurrency }) {
  const userIds = Array.from({ length: users }, (_, idx) => `u${idx + 1}`);
  const current = new Map(userIds.map((u) => [u, 0]));

  let ok = 0;
  let fail = 0;

  const startedAt = Date.now();
  const times = [];

  let inFlight = 0;
  let idx = 0;

  return new Promise((resolve) => {
    const launchNext = async () => {
      if (idx >= bids) {
        if (inFlight === 0) {
          const totalMs = Date.now() - startedAt;
          resolve({ ok, fail, totalMs, times });
        }
        return;
      }

      while (inFlight < concurrency && idx < bids) {
        const n = idx++;
        inFlight++;

        (async () => {
          const userId = userIds[n % userIds.length];
          const prev = current.get(userId) ?? 0;

          // Always increase (so "only up" rule satisfied)
          const delta = 1 + (n % 50); // 1..50
          const amount = prev + delta;
          current.set(userId, amount);

          const body = {
            auctionId,
            roundId,
            userId,
            currency: 'TON',
            amount,
            idempotencyKey: `load:${auctionId}:${roundId}:${userId}:${n}:${Date.now()}`,
          };

          const t0 = Date.now();
          try {
            await httpJson('POST', '/bids', body);
            ok++;
          } catch (e) {
            fail++;
            // If round closed mid-run, count as fail and stop pushing more
            const msg = String(e && e.message ? e.message : e);
            if (msg.includes('Round is not OPEN')) {
              // Stop scheduling new bids quickly by exhausting idx
              idx = bids;
            }
          } finally {
            times.push(Date.now() - t0);
            inFlight--;
            launchNext();
          }
        })();
      }
    };

    launchNext();
  });
}

async function waitForSettlement(db, { roundId, users }) {
  const rounds = db.collection('rounds');
  const allocations = db.collection('allocations');
  const wallets = db.collection('wallets');
  const ledger = db.collection('ledger_entries');

  const userIds = Array.from({ length: users }, (_, idx) => `u${idx + 1}`);

  // wait round CLOSED
  for (let i = 0; i < 120; i++) {
    const r = await rounds.findOne({ _id: new mongoose.Types.ObjectId(roundId) });
    if (r && r.status === 'CLOSED') break;
    await sleep(500);
  }

  // wait allocations all SETTLED (or none if nobody bid)
  for (let i = 0; i < 240; i++) {
    const total = await allocations.countDocuments({ roundId: String(roundId) });
    const settled = await allocations.countDocuments({ roundId: String(roundId), status: 'SETTLED' });
    if (total > 0 && settled === total) break;
    if (total === 0) break;
    await sleep(500);
  }

  // invariants:
  const ws = await wallets
    .find({ userId: { $in: userIds }, currency: 'TON' })
    .project({ _id: 0, userId: 1, reserved: 1 })
    .toArray();

  const reservedNonZero = ws.filter((w) => Number(w.reserved) !== 0);

  const dupSettle = await ledger
    .aggregate([
      { $match: { entryKey: { $regex: '^settle:' }, roundId: String(roundId) } },
      { $group: { _id: '$entryKey', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();

  const allocSummary = await allocations
    .aggregate([
      { $match: { roundId: String(roundId) } },
      { $group: { _id: '$kind', c: { $sum: 1 } } },
    ])
    .toArray();

  return { reservedNonZero, dupSettle, allocSummary };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.floor((p / 100) * (a.length - 1));
  return a[idx];
}

async function main() {
  const cfg = parseArgs();

  console.log('BASE_URL:', BASE_URL);
  console.log('MONGO_URI:', MONGO_URI);
  console.log('CFG:', cfg);

  const conn = await mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = conn.db;

  console.log('1) credit users...');
  await creditUsers(db, cfg);
  console.log('   ok');

  console.log('2) create auction...');
  const created = await httpJson('POST', '/auctions', {
    currency: 'TON',
    roundDurationSec: cfg.duration,
    winnersPerRound: cfg.winners,
    maxRounds: 1,
    antiSnipe: { windowSec: 10, extendSec: 10, maxTotalExtendSec: 60 },
  });
  const auctionId = created.auctionId;
  const roundId = created.activeRoundId;

  console.log('   auctionId:', auctionId);
  console.log('   roundId:', roundId);
  console.log('   endAt:', created.endAt);

  console.log('3) run bids...');
  const bidRes = await runBids({ auctionId, roundId, ...cfg });
  console.log('   bids done:', bidRes);

  console.log('4) wait settlement + validate invariants...');
  const inv = await waitForSettlement(db, { roundId, users: cfg.users });

  const p50 = percentile(bidRes.times, 50);
  const p95 = percentile(bidRes.times, 95);
  const p99 = percentile(bidRes.times, 99);

  console.log('\n=== RESULTS ===');
  console.log('OK bids:', bidRes.ok, 'FAIL bids:', bidRes.fail);
  console.log('Total time ms:', bidRes.totalMs);
  console.log('Latency ms p50/p95/p99:', p50, p95, p99);
  console.log('Allocations summary (by kind):', inv.allocSummary);
  console.log('Reserved non-zero wallets:', inv.reservedNonZero.length);
  if (inv.reservedNonZero.length) console.log(inv.reservedNonZero.slice(0, 10));
  console.log('Duplicate settle ledger keys:', inv.dupSettle.length);
  if (inv.dupSettle.length) console.log(inv.dupSettle);

  if (inv.reservedNonZero.length || inv.dupSettle.length) {
    console.log('\n❌ INVARIANTS FAILED');
    process.exitCode = 1;
  } else {
    console.log('\n✅ INVARIANTS OK');
  }

  await conn.close();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exitCode = 1;
});
