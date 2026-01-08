import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuctionDocument = HydratedDocument<AuctionModel>;

export type AuctionStatus = 'DRAFT' | 'LIVE' | 'FINISHED' | 'CANCELLED';

@Schema({ collection: 'auctions', timestamps: true })
export class AuctionModel {
  @Prop({ required: true })
  currency!: string;

  @Prop({ required: true, default: 'LIVE' })
  status!: AuctionStatus;

  @Prop({ required: true })
  activeRoundId!: string; // store as string for API simplicity

  @Prop({ required: true, default: 1 })
  activeRoundNo!: number;

  @Prop({
    required: true,
    type: Object,
  })
  roundConfig!: {
    roundDurationSec: number;
    winnersPerRound: number;
    maxRounds: number;
    antiSnipe: {
      windowSec: number;
      extendSec: number;
      maxTotalExtendSec: number;
    };
  };
}

export const AuctionSchema = SchemaFactory.createForClass(AuctionModel);

// Helpful indexes
AuctionSchema.index({ status: 1, currency: 1 });
AuctionSchema.index({ activeRoundId: 1 });
