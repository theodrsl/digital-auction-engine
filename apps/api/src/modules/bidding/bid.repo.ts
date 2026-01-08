import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { BidDocument, BidModel } from './bid.schema';

@Injectable()
export class BidRepo {
  constructor(
    @InjectModel(BidModel.name)
    private readonly bidModel: Model<BidDocument>,
  ) {}

  async findActive(
    input: { auctionId: string; userId: string },
    session?: ClientSession,
  ): Promise<BidDocument | null> {
    return this.bidModel
      .findOne({ auctionId: input.auctionId, userId: input.userId })
      .session(session ?? null);
  }

  async upsertActive(
    input: {
      auctionId: string;
      userId: string;
      roundId: string;
      currency: string;
      amount: number;
      lastBidAt: Date;
    },
    session?: ClientSession,
  ): Promise<BidDocument> {
    return this.bidModel.findOneAndUpdate(
      { auctionId: input.auctionId, userId: input.userId },
      {
        $set: {
          roundId: input.roundId,
          currency: input.currency,
          amount: input.amount,
          lastBidAt: input.lastBidAt,
        },
      },
      {
        new: true,
        upsert: true,
        session: session ?? undefined,
      },
    );
  }
}
