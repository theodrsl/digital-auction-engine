import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { QUEUE_SETTLEMENT, JOB_SETTLE_ALLOCATION } from '../jobs/queues';
import { AllocationDocument, AllocationModel } from './allocation.schema';
import { WalletDocument, WalletModel } from '../wallet/wallet.schema';
import { LedgerEntryDocument, LedgerEntryModel } from '../wallet/ledger.schema';

type BidLike = {
  userId: string;
  roundId: string;
  auctionId?: any;
  amount: number;
  currency: string;
  status?: string | null;
  lastBidAt?: Date;
};

@Processor(QUEUE_SETTLEMENT)
export class SettlementProcessor extends WorkerHost {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(AllocationModel.name) private readonly allocationModel: Model<AllocationDocument>,
    @InjectModel(WalletModel.name) private readonly walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntryModel.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOB_SETTLE_ALLOCATION) return;

    const { allocationId } = job.data as { allocationId: string };
    if (!allocationId) return;

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        const allocation = await this.allocationModel.findById(allocationId).session(session);
        if (!allocation) return;
        if (allocation.status === 'SETTLED') return;

        // best-effort lock
        if (allocation.status === 'PENDING') {
          allocation.status = 'SETTLING';
          await allocation.save({ session });
        }

        // 1) Read current wallet snapshot (we must never "capture" more than wallet.reserved)
        const wallet = await this.walletModel
          .findOne({ userId: allocation.userId, currency: allocation.currency })
          .session(session);

        if (!wallet) {
          throw new Error(
            `[settlement] wallet not found user=${allocation.userId} currency=${allocation.currency}`,
          );
        }

        // 2) Determine settle amount from CURRENT bid state (delta-reserve model)
        // Prefer ACTIVE bid for this round+user. If your bids don't have status, it will still find latest by amount/lastBidAt.
        const bidsCol = this.conn.collection<BidLike>('bids');

        const bid = await bidsCol
          .find({
            userId: allocation.userId,
            roundId: allocation.roundId,
            currency: allocation.currency,
            status: { $in: ['ACTIVE', null] },
          })
          .sort({ amount: -1, lastBidAt: 1 })
          .limit(1)
          .toArray();

        const bidAmount = Number(bid?.[0]?.amount ?? 0);

        // allocation.bidAmount = amount snapshot at close time (winner/loser best bid)
        const allocationAmount = Number(allocation.bidAmount ?? 0);

        // Candidate = prefer bidAmount if present else allocationAmount
        const candidate = bidAmount > 0 ? bidAmount : allocationAmount;

        // CRITICAL: never try to move more than current wallet.reserved
        const settleAmount = Math.max(0, Math.min(Number(wallet.reserved ?? 0), candidate));

        const op = allocation.kind === 'WIN' ? 'CAPTURE' : 'RELEASE';
        const entryKey = `settle:${allocation._id.toString()}:${op}`;

        // If nothing reserved now => settle as no-op (idempotent), mark SETTLED
        if (settleAmount > 0) {
          // 3) ledger (idempotent by unique entryKey)
          try {
            await this.ledgerModel.create(
              [
                {
                  entryKey,
                  userId: allocation.userId,
                  currency: allocation.currency,
                  type: op,
                  amount: settleAmount,
                  from: 'RESERVED',
                  to: allocation.kind === 'WIN' ? 'SINK' : 'AVAILABLE',
                  auctionId: allocation.auctionId,
                  roundId: allocation.roundId,
                  meta: {
                    allocationId: allocation._id.toString(),
                    allocationKind: allocation.kind,
                    bidAmount,
                    allocationAmount,
                    walletReservedAtSettle: Number(wallet.reserved ?? 0),
                    at: new Date().toISOString(),
                  },
                },
              ],
              { session },
            );
          } catch (e: any) {
            if (String(e?.code) !== '11000') throw e;
            // already have ledger entry => proceed to wallet move (may have been rolled back earlier, but ok)
          }

          // 4) wallet move (CAS)
          if (allocation.kind === 'WIN') {
            const res = await this.walletModel.updateOne(
              {
                userId: allocation.userId,
                currency: allocation.currency,
                reserved: { $gte: settleAmount },
              },
              { $inc: { reserved: -settleAmount, version: 1 } },
              { session },
            );

            if (res.modifiedCount !== 1) {
              throw new Error(
                `[settlement] CAPTURE wallet move failed user=${allocation.userId} round=${allocation.roundId} amount=${settleAmount}`,
              );
            }
          } else {
            const res = await this.walletModel.updateOne(
              {
                userId: allocation.userId,
                currency: allocation.currency,
                reserved: { $gte: settleAmount },
              },
              { $inc: { reserved: -settleAmount, available: settleAmount, version: 1 } },
              { session },
            );

            if (res.modifiedCount !== 1) {
              throw new Error(
                `[settlement] RELEASE wallet move failed user=${allocation.userId} round=${allocation.roundId} amount=${settleAmount}`,
              );
            }
          }
        }

        // 5) finalize allocation
        allocation.status = 'SETTLED';
        allocation.settlementId = allocation.settlementId ?? `settle:${allocation._id.toString()}`;
        await allocation.save({ session });
      });
    } catch (e) {
      try {
        await this.allocationModel.updateOne(
          { _id: allocationId, status: { $ne: 'SETTLED' } },
          { $set: { status: 'FAILED' } },
        );
      } catch (_) {}
      throw e;
    } finally {
      await session.endSession();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // console.error(`[settlement] failed job=${job.id} name=${job.name}`, err);
  }
}
