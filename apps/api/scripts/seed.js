require("dotenv/config");
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || "digital_auction";
  if (!uri) throw new Error("MONGO_URI missing");

  await mongoose.connect(uri, { dbName });

  const RoundSchema = new mongoose.Schema(
    {
      auctionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      no: { type: Number, required: true },
      status: { type: String, required: true },
      startAt: { type: Date, required: true },
      endAt: { type: Date, required: true },
      antiSnipe: { totalExtendedSec: { type: Number, required: true, default: 0 } },
    },
    { collection: "rounds", timestamps: true }
  );

  const WalletSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true },
      currency: { type: String, required: true },
      available: { type: Number, required: true, default: 0 },
      reserved: { type: Number, required: true, default: 0 },
      version: { type: Number, required: true, default: 0 },
    },
    { collection: "wallets", timestamps: true }
  );

  const LedgerSchema = new mongoose.Schema(
    {
      entryKey: { type: String, required: true, unique: true },
      userId: { type: String, required: true },
      currency: { type: String, required: true },
      type: { type: String, required: true },
      amount: { type: Number, required: true },
      from: { type: String, required: true },
      to: { type: String, required: true },
    },
    { collection: "ledger_entries", timestamps: { createdAt: true, updatedAt: false } }
  );

  const Round = mongoose.model("Round", RoundSchema);
  const Wallet = mongoose.model("Wallet", WalletSchema);
  const Ledger = mongoose.model("Ledger", LedgerSchema);

  const auctionId = new mongoose.Types.ObjectId();
  const now = new Date();

  const round = await Round.create({
    auctionId,
    no: 1,
    status: "OPEN",
    startAt: now,
    endAt: new Date(now.getTime() + 60_000),
    antiSnipe: { totalExtendedSec: 0 },
  });

  const userId = "u1";
  const currency = "TON";
  const credit = 10_000;

  await Wallet.updateOne(
    { userId, currency },
    { $setOnInsert: { userId, currency, available: 0, reserved: 0, version: 0 } },
    { upsert: true }
  );

  const entryKey = `seed:credit:${userId}:${Date.now()}`;
  await Ledger.create({
    entryKey,
    userId,
    currency,
    type: "CREDIT",
    amount: credit,
    from: "EXTERNAL",
    to: "AVAILABLE",
  });

  await Wallet.updateOne({ userId, currency }, { $inc: { available: credit, version: 1 } });

  console.log("Seed OK");
  console.log("auctionId:", auctionId.toString());
  console.log("roundId:", round._id.toString());
  console.log("userId:", userId);
  console.log("currency:", currency);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});