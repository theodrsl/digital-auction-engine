import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'bids', timestamps: true })
export class BidModel {
  @Prop({ type: String, required: true })
  auctionId!: string;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  roundId!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  lastBidAt!: Date;
}

export type BidDocument = HydratedDocument<BidModel>;
export const BidSchema = SchemaFactory.createForClass(BidModel);

BidSchema.index(
  { auctionId: 1, userId: 1 },
  { unique: true, name: 'uq_bid_active_per_user' },
);

BidSchema.index(
  { auctionId: 1, roundId: 1, amount: -1, lastBidAt: 1 },
  { name: 'ix_round_leaderboard' },
);
