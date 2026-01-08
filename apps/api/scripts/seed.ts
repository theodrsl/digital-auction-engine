/* eslint-disable no-console */
require('dotenv/config');

const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'digital_auction';

  await mongoose.connect(uri, { dbName });

  const Auction = mongoose.connection.collection('auctions');
  const Round = mongoose.connection.collection('rounds');
  const Wallets = mongoose.connection.collection('wallets');
  const Ledger = mongoose.connection.collection('ledger_entries');

  const auctionId = new mongoose.Types.ObjectId();
  const roundId = new mongoose.Types.ObjectId();

  const now = new Date();
  const endAt = new Date(now.getTime() + 60_000);

  await Auction.insertOne({
    _id: auctionId,
    currency: 'TON',
    status: 'LIVE',
    activeRoundId: roundId.toString(),
    activeRoundNo: 1,
    roundConfig: {
      roundDurationSec: 60,
      winnersPerRound: 10,
      maxRounds: 100,
      antiSnipe: { windowSec: 10, extendSec: 10, maxTotalExtendSec: 120 },
    },
    createdAt: now,
    updatedAt: now,
  });

  await Round.insertOne({
    _id: roundId,
    auctionId: auctionId.toString(),
    no: 1,
    status: 'OPEN',
    startAt: now,
    endAt,
    antiSnipe: { totalExtendedSec: 0 },
    createdAt: now,
    updatedAt: now,
  });

  const userId = 'u1';
  const currency = 'TON';

  await Wallets.updateOne(
    { userId, currency },
    {
      $setOnInsert: {
        userId,
        currency,
        available: 10000,
        reserved: 0,
        version: 0,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  );

  await Ledger.insertOne({
    entryKey: `seed:credit:${userId}:${Date.now()}`,
    userId,
    currency,
    type: 'CREDIT',
    amount: 10000,
    from: 'EXTERNAL',
    to: 'AVAILABLE',
    createdAt: now,
  });

  console.log('Seed OK');
  console.log('auctionId:', auctionId.toString());
  console.log('roundId:', roundId.toString());
  console.log('userId:', userId);
  console.log('currency:', currency);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
