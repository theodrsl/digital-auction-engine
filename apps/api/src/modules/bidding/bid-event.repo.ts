import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { BidEventDocument, BidEventModel } from './bid-event.schema';

@Injectable()
export class BidEventRepo {
  constructor(
    @InjectModel(BidEventModel.name)
    private readonly bidEventModel: Model<BidEventDocument>,
  ) {}

  async findByIdempotency(
    input: { auctionId: string; userId: string; idempotencyKey: string },
    session?: ClientSession,
  ): Promise<BidEventDocument | null> {
    return this.bidEventModel
      .findOne({
        auctionId: input.auctionId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      })
      .session(session ?? null);
  }

  async create(
    input: {
      auctionId: string;
      roundId: string;
      userId: string;
      currency: string;
      amount: number;
      prevAmount: number;
      delta: number;
      idempotencyKey: string;
    },
    session?: ClientSession,
  ): Promise<BidEventDocument> {
    const doc = new this.bidEventModel(input);
    await doc.save({ session: session ?? undefined });
    return doc;
  }
}
