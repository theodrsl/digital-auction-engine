import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'bid_events', timestamps: { createdAt: true, updatedAt: false } })
export class BidEventModel {
  @Prop({ type: String, required: true })
  auctionId!: string;

  @Prop({ type: String, required: true })
  roundId!: string;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Number, required: true })
  prevAmount!: number;

  @Prop({ type: Number, required: true })
  delta!: number;

  @Prop({ type: String, required: true })
  idempotencyKey!: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;
}

export type BidEventDocument = HydratedDocument<BidEventModel>;
export const BidEventSchema = SchemaFactory.createForClass(BidEventModel);

// ключевая вещь:
BidEventSchema.index(
  { auctionId: 1, userId: 1, idempotencyKey: 1 },
  { unique: true, name: 'uq_bid_event_idem' },
);

BidEventSchema.index(
  { auctionId: 1, roundId: 1, amount: -1, createdAt: 1 },
  { name: 'ix_round_amount_desc' },
);
