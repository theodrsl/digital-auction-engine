import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import {
  QUEUE_ROUND_CLOSE,
  JOB_CLOSE_ROUND,
  QUEUE_SETTLEMENT,
  JOB_SETTLE_ALLOCATION,
} from '../jobs/queues';

import { AllocationModel, AllocationDocument } from '../settlement/allocation.schema';
import { RoundModel, RoundDocument } from './round.schema';
import { BidModel, BidDocument } from '../bidding/bid.schema';

function settleJobId(roundId: string, userId: string) {
  return `settle:${roundId}:${userId}`;
}

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

    const round = await this.roundModel.findOneAndUpdate(
      { _id: roundId, status: 'OPEN' },
      { $set: { status: 'CLOSING' } },
      { new: true },
    );

    if (!round) return;

    const auctionsCol = this.conn.collection('auctions');
    const auction = await auctionsCol.findOne({ _id: round.auctionId as any });

    const winnersPerRound = Math.max(
      1,
      Number((auction as any)?.roundConfig?.winnersPerRound ?? 10),
    );

    const pipeline: any[] = [
      { $match: { roundId: String(round._id) } },
      { $sort: { amount: -1, lastBidAt: 1 } },
      {
        $group: {
          _id: '$userId',
          userId: { $first: '$userId' },
          amount: { $first: '$amount' },
          currency: { $first: '$currency' },
          lastBidAt: { $first: '$lastBidAt' },
        },
      },
      { $sort: { amount: -1, lastBidAt: 1 } },
      {
        $setWindowFields: {
          sortBy: { amount: -1, lastBidAt: 1 },
          output: { rank: { $rank: {} } },
        },
      },
      {
        $project: {
          _id: 0,
          userId: 1,
          amount: 1,
          currency: 1,
          rank: 1,
        },
      },
    ];

    const cursor = this.bidModel
      .aggregate(pipeline, { allowDiskUse: true })
      .cursor({ batchSize: 1000 });

    const allocOps: any[] = [];
    const jobOps: any[] = [];

    const flush = async () => {
      if (allocOps.length) {
        await this.allocationModel.bulkWrite(allocOps, { ordered: false });
        allocOps.length = 0;
      }
      if (jobOps.length) {
        await this.settlementQueue.addBulk(jobOps.splice(0, jobOps.length));
      }
    };

    let any = false;

    for await (const row of cursor as any) {
      any = true;

      const userId = String(row.userId);
      const currency = String(row.currency);
      const bidAmount = Math.max(0, Number(row.amount ?? 0));
      const finalAmount = bidAmount;

      const isWin = Number(row.rank ?? 0) <= winnersPerRound;
      const kind = isWin ? 'WIN' : 'CARRY';

      allocOps.push({
        updateOne: {
          filter: { roundId: String(round._id), userId },
          update: {
            $setOnInsert: {
              auctionId: String(round.auctionId),
              roundId: String(round._id),
              roundNo: round.no,
              userId,
              currency,
              status: 'PENDING',
            },
            $set: {
              currency,
              bidAmount,
              finalAmount,
              kind,
            },
          },
          upsert: true,
        },
      });

      jobOps.push({
        name: JOB_SETTLE_ALLOCATION,
        data: { roundId: String(round._id), userId },
        opts: {
          jobId: settleJobId(String(round._id), userId),
          removeOnComplete: true,
          removeOnFail: 500,
          attempts: 10,
          backoff: { type: 'exponential', delay: 1000 },
        },
      });

      if (allocOps.length >= 1000) {
        await flush();
      }
    }

    await flush();

    await this.roundModel.updateOne(
      { _id: round._id, status: 'CLOSING' },
      { $set: { status: 'CLOSED', closedAt: new Date() } },
    );

    if (!any) return;
  }
}
