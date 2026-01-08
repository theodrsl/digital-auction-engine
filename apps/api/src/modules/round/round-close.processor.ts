import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { QUEUE_ROUND_CLOSE, JOB_CLOSE_ROUND, QUEUE_SETTLEMENT, JOB_SETTLE_ALLOCATION, settleAllocationJobId } from '../jobs/queues';
import { AllocationModel, AllocationDocument } from '../settlement/allocation.schema';

// IMPORTANT: подстрой под твой Round schema/model
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

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        // CAS: OPEN -> CLOSING
        const round = await this.roundModel.findOneAndUpdate(
          { _id: roundId, status: 'OPEN' },
          { $set: { status: 'CLOSING' } },
          { new: true, session },
        );

        if (!round) {
          // already closing/closed
          return;
        }

        // TODO: winnersPerRound брать из auction config (пока фикс)
        const winnersPerRound = 10;

        // Snapshot: top bids by auction (и при желании по roundId)
        const top = await this.bidModel
          .find({ auctionId: String(round.auctionId) })
          .sort({ amount: -1, lastBidAt: 1 })
          .limit(winnersPerRound)
          .session(session);

        // Create allocations (idempotent via uq_allocation_round_user)
        for (const b of top) {
          await this.allocationModel.updateOne(
            { roundId: String(round._id), userId: b.userId },
            {
              $setOnInsert: {
                auctionId: String(round.auctionId),
                roundId: String(round._id),
                roundNo: round.no,
                userId: b.userId,
                currency: b.currency,
                bidAmount: b.amount,
                kind: 'WIN',
                status: 'PENDING',
              },
            },
            { upsert: true, session },
          );
        }

        await this.roundModel.updateOne(
          { _id: round._id },
          { $set: { status: 'CLOSED', closedAt: new Date() } },
          { session },
        );
      });

      // enqueue settlement OUTSIDE tx
      const allocations = await this.allocationModel.find({ roundId: String(roundId), kind: 'WIN' }).lean();
      for (const a of allocations) {
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
