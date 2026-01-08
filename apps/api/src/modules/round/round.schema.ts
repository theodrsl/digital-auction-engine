import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RoundStatus } from '@digital-auction/shared';

export type RoundDocument = HydratedDocument<RoundModel>;

@Schema({ collection: 'rounds', timestamps: true })
export class RoundModel {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  auctionId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  no!: number;

  @Prop({ type: String, required: true, enum: Object.values(RoundStatus) })
  status!: RoundStatus;

  @Prop({ type: Date, required: true })
  startAt!: Date;

  @Prop({ type: Date, required: true })
  endAt!: Date;

  @Prop({
    type: {
      totalExtendedSec: { type: Number, required: true, default: 0 },
    },
    required: true,
    default: { totalExtendedSec: 0 },
  })
  antiSnipe!: { totalExtendedSec: number };

  @Prop({ type: String })
  closeJobId?: string;

  @Prop({ type: Date })
  closedAt?: Date;
}

export const RoundSchema = SchemaFactory.createForClass(RoundModel);

RoundSchema.index({ auctionId: 1, no: 1 }, { unique: true });
RoundSchema.index({ auctionId: 1, status: 1, endAt: 1 });
