import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import {
  QUEUE_ROUND_CLOSE,
  JOB_CLOSE_ROUND,
  QUEUE_SETTLEMENT,
  JOB_SETTLE_ALLOCATION,
  settleAllocationJobId,
} from '../jobs/queues';

import { AllocationModel, AllocationDocument } from '../settlement/allocation.schema';
import { RoundModel, RoundDocument } from './round.schema';
import { BidModel, BidDocument } from '../bidding/bid.schema';

@Processor(QUEUE_ROUND_CLOSE)
export class RoundCloseProcessor extends WorkerHost {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(RoundModel.name) private readonly roundModel: Model<RoundDocument>,
    @InjectModel(BidModel.name) private readonly bidModel: Model<BidDocument>,
    @InjectModel(AllocationModel.name) private readonly allocationModel: Model<AllocationDocument>,
    @InjectQueue(QUEUE_SETTLEMENT) private readonly settlementQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOB_CLOSE_ROUND) return;

    const { roundId } = job.data as { roundId: string };
    if (!roundId) return;

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        // CAS: OPEN -> CLOSING
        const round = await this.roundModel.findOneAndUpdate(
          { _id: roundId, status: 'OPEN' },
          { $set: { status: 'CLOSING' } },
          { new: true, session },
        );

        if (!round) return; // already closing/closed

        // winnersPerRound: берём из auction.roundConfig
        const auctionsCol = this.conn.collection('auctions');
        const auction = await auctionsCol.findOne(
          { _id: round.auctionId as any },
          { session },
        );

        const winnersPerRound = Math.max(
          1,
          Number((auction as any)?.roundConfig?.winnersPerRound ?? 10),
        );

        // IMPORTANT: только текущий roundId
        // Сортировка: amount desc, lastBidAt asc (раньше при равенстве)
        const bidsSorted = await this.bidModel
          .find({ roundId: String(round._id) })
          .sort({ amount: -1, lastBidAt: 1 })
          .session(session)
          .lean();

        // Дедуп по userId (берём первый из отсортированного списка)
        const seen = new Set<string>();
        const bestByUser: Array<{ userId: string; amount: number; currency: string }> = [];
        for (const b of bidsSorted as any[]) {
          const uid = String(b.userId);
          if (seen.has(uid)) continue;
          seen.add(uid);
          bestByUser.push({
            userId: uid,
            amount: Number(b.amount),
            currency: String(b.currency),
          });
        }

        // Если ставок нет — просто закрываем
        if (bestByUser.length === 0) {
          await this.roundModel.updateOne(
            { _id: round._id },
            { $set: { status: 'CLOSED', closedAt: new Date() } },
            { session },
          );
          return;
        }

        const winners = bestByUser.slice(0, winnersPerRound);
        const losers = bestByUser.slice(winnersPerRound);

        // 1) WIN allocations
        for (const w of winners) {
          await this.allocationModel.updateOne(
            { roundId: String(round._id), userId: w.userId },
            {
              $setOnInsert: {
                auctionId: String(round.auctionId),
                roundId: String(round._id),
                roundNo: round.no,
                userId: w.userId,
                currency: w.currency,
                bidAmount: w.amount,
                kind: 'WIN',
                status: 'PENDING',
              },
            },
            { upsert: true, session },
          );
        }

        // 2) CARRY allocations (проигравшие должны получить RELEASE)
        for (const l of losers) {
          await this.allocationModel.updateOne(
            { roundId: String(round._id), userId: l.userId },
            {
              $setOnInsert: {
                auctionId: String(round.auctionId),
                roundId: String(round._id),
                roundNo: round.no,
                userId: l.userId,
                currency: l.currency,
                bidAmount: l.amount,
                kind: 'CARRY',
                status: 'PENDING',
              },
            },
            { upsert: true, session },
          );
        }

        // finalize round
        await this.roundModel.updateOne(
          { _id: round._id },
          { $set: { status: 'CLOSED', closedAt: new Date() } },
          { session },
        );
      });

      // enqueue settlement OUTSIDE tx (idempotent via jobId + settlement entryKey)
      const allocations = await this.allocationModel.find({ roundId: String(roundId) }).lean();

      for (const a of allocations as any[]) {
        await this.settlementQueue.add(
          JOB_SETTLE_ALLOCATION,
          { allocationId: String(a._id) },
          {
            jobId: settleAllocationJobId(String(a._id)),
            removeOnComplete: true,
            removeOnFail: 500,
            attempts: 10,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
      }
    } finally {
      await session.endSession();
    }
  }
}
