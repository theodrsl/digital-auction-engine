import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { AuctionModel, AuctionDocument } from './auction.schema';
import { CreateAuctionDto } from './dto/create-auction.dto';

// IMPORTANT: keep jobId without ":" (BullMQ restriction)
function closeRoundJobId(roundId: string) {
  return `round-close__${roundId}`;
}

@Injectable()
export class AuctionService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(AuctionModel.name) private readonly auctions: Model<AuctionDocument>,
    @InjectQueue('round-close') private readonly roundCloseQueue: Queue,
  ) {}

  async create(dto: CreateAuctionDto) {
    const now = new Date();

    // Round#1 dates
    const startAt = now;
    const endAt = new Date(now.getTime() + dto.roundDurationSec * 1000);

    const auctionId = new Types.ObjectId();
    const roundId = new Types.ObjectId();

    // Use raw collections to avoid fighting existing Round schema types right now
    const roundsCol = this.conn.collection('rounds');

    await this.conn.transaction(async (session) => {
      await this.auctions.create(
        [
          {
            _id: auctionId,
            currency: dto.currency,
            status: 'LIVE',
            activeRoundId: roundId.toString(),
            activeRoundNo: 1,
            roundConfig: {
              roundDurationSec: dto.roundDurationSec,
              winnersPerRound: dto.winnersPerRound,
              maxRounds: dto.maxRounds,
              antiSnipe: {
                windowSec: dto.antiSnipe.windowSec,
                extendSec: dto.antiSnipe.extendSec,
                maxTotalExtendSec: dto.antiSnipe.maxTotalExtendSec,
              },
            },
          },
        ],
        { session },
      );

      await roundsCol.insertOne(
        {
          _id: roundId,
          auctionId: auctionId, // keep ObjectId in rounds (matches what you currently have)
          no: 1,
          status: 'OPEN',
          startAt,
          endAt,
          antiSnipe: { totalExtendedSec: 0 },
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
    });

    // Schedule round-close at endAt
    const delayMs = Math.max(0, endAt.getTime() - Date.now());
    await this.roundCloseQueue.add(
      'close-round',
      { roundId: roundId.toString() },
      {
        jobId: closeRoundJobId(roundId.toString()),
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 200,
        attempts: 5,
        backoff: { type: 'exponential', delay: 500 },
      },
    );

    return {
      auctionId: auctionId.toString(),
      activeRoundId: roundId.toString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  async getById(auctionId: string) {
    const auction = await this.auctions.findById(auctionId).lean();
    if (!auction) throw new NotFoundException('Auction not found');

    const roundsCol = this.conn.collection('rounds');
    const round = await roundsCol.findOne({ _id: new Types.ObjectId(auction.activeRoundId) });

    return {
      auction: {
        id: auction._id.toString(),
        currency: auction.currency,
        status: auction.status,
        activeRoundId: auction.activeRoundId,
        activeRoundNo: auction.activeRoundNo,
        roundConfig: auction.roundConfig,
      },
      activeRound: round
        ? {
            id: round._id.toString(),
            auctionId: round.auctionId.toString(),
            no: round.no,
            status: round.status,
            startAt: round.startAt,
            endAt: round.endAt,
            antiSnipe: round.antiSnipe,
            closedAt: round.closedAt ?? null,
          }
        : null,
    };
  }

  async leaderboard(auctionId: string, limit = 20) {
    const bidsCol = this.conn.collection('bids');

    // In your system bid is 1 active per user per auction. We rank by amount desc, tie by lastBidAt asc.
    const rows = await bidsCol
      .find({ auctionId: auctionId, status: { $in: ['ACTIVE', null] } })
      .project({ _id: 0, userId: 1, amount: 1, lastBidAt: 1, currency: 1 })
      .sort({ amount: -1, lastBidAt: 1 })
      .limit(limit)
      .toArray();

    return { auctionId, items: rows };
  }
}
