import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { QUEUE_SETTLEMENT, JOB_SETTLE_ALLOCATION } from '../jobs/queues';
import { AllocationDocument, AllocationModel } from './allocation.schema';
import { WalletDocument, WalletModel } from '../wallet/wallet.schema';

function nowIso() {
  return new Date().toISOString();
}

@Processor(QUEUE_SETTLEMENT)
export class SettlementProcessor extends WorkerHost {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(AllocationModel.name) private readonly allocationModel: Model<AllocationDocument>,
    @InjectModel(WalletModel.name) private readonly walletModel: Model<WalletDocument>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOB_SETTLE_ALLOCATION) return;

    const { allocationId } = job.data as { allocationId: string };
    if (!allocationId) return;

    const _id = Types.ObjectId.isValid(allocationId) ? new Types.ObjectId(allocationId) : null;
    if (!_id) return;

    const allocationsCol = this.conn.collection('allocations');
    const ledgerCol = this.conn.collection('ledger_entries');

    const session = await this.conn.startSession();

    try {
      await session.withTransaction(async () => {
        const allocation = await allocationsCol.findOne({ _id }, { session });
        if (!allocation) return;

        if (allocation.status === 'SETTLED') return;

        const settlementId: string =
          allocation.settlementId ?? `settle:${allocation._id.toString()}`;

        // claim SETTLING (idempotent)
        await allocationsCol.updateOne(
          { _id, status: { $in: ['PENDING', 'FAILED', 'SETTLING'] } },
          { $set: { status: 'SETTLING', settlementId } },
          { session },
        );

        const amount: number = Number(allocation.bidAmount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          await allocationsCol.updateOne(
            { _id },
            { $set: { status: 'FAILED' } },
            { session },
          );
          return;
        }

        const userId: string = allocation.userId;
        const currency: string = allocation.currency;
        const auctionId: string = allocation.auctionId;
        const roundId: string = allocation.roundId;

        const op = allocation.kind === 'WIN' ? 'CAPTURE' : 'RELEASE';
        const entryKey = `${settlementId}:${op}`;

        // 1) ledger insert (unique by entryKey)
        // raw insert to bypass enum limitations in mongoose schema
        let insertedLedger = false;
        try {
          await ledgerCol.insertOne(
            {
              entryKey,
              userId,
              currency,
              type: op, // "CAPTURE" | "RELEASE"
              amount,
              from: 'RESERVED',
              to: allocation.kind === 'WIN' ? 'SPENT' : 'AVAILABLE',
              auctionId,
              roundId,
              meta: {
                allocationId: allocation._id.toString(),
                allocationKind: allocation.kind,
                at: nowIso(),
              },
              createdAt: new Date(),
            },
            { session },
          );
          insertedLedger = true;
        } catch (e: any) {
          if (String(e?.code) !== '11000') throw e; // not duplicate key
        }

        // 2) wallet move (через Mongoose Model => точно в правильную БД/коннект)
        // делаем только если ledger реально вставили сейчас (иначе это повтор job)
        if (insertedLedger) {
          if (allocation.kind === 'WIN') {
            const res = await this.walletModel.updateOne(
              { userId, currency, reserved: { $gte: amount } },
              { $inc: { reserved: -amount, version: 1 } },
              { session },
            );
            if (res.modifiedCount !== 1) {
              throw new Error('Settlement CAPTURE failed: reserved funds missing');
            }
          } else {
            const res = await this.walletModel.updateOne(
              { userId, currency, reserved: { $gte: amount } },
              { $inc: { reserved: -amount, available: amount, version: 1 } },
              { session },
            );
            if (res.modifiedCount !== 1) {
              throw new Error('Settlement RELEASE failed: reserved funds missing');
            }
          }
        }

        // 3) finalize allocation
        await allocationsCol.updateOne(
          { _id },
          { $set: { status: 'SETTLED', settlementId } },
          { session },
        );
      });
    } catch (e) {
      // best-effort mark FAILED (let queue retry)
      try {
        await this.allocationModel.updateOne({ _id }, { $set: { status: 'FAILED' } });
      } catch {
        // ignore
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // TODO: structured logging
    // console.error(`[settlement] failed job=${job.id}`, err);
  }
}
