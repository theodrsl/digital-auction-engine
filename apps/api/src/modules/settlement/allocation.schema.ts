import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AllocationDocument = AllocationModel & Document;

export type AllocationKind = 'WIN' | 'CARRY';
export type AllocationStatus = 'PENDING' | 'SETTLING' | 'SETTLED' | 'FAILED';

@Schema({ collection: 'allocations', timestamps: true })
export class AllocationModel {
  @Prop({ required: true })
  auctionId!: string;

  @Prop({ required: true })
  roundId!: string;

  @Prop({ required: true })
  roundNo!: number;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  currency!: string;

  @Prop({ required: true, min: 0 })
  bidAmount!: number;

  @Prop({ required: true, enum: ['WIN', 'CARRY'] })
  kind!: AllocationKind;

  @Prop({ required: true, enum: ['PENDING', 'SETTLING', 'SETTLED', 'FAILED'], default: 'PENDING' })
  status!: AllocationStatus;

  @Prop({ required: false })
  settlementId?: string;
}

export const AllocationSchema = SchemaFactory.createForClass(AllocationModel);

AllocationSchema.index({ roundId: 1, userId: 1 }, { unique: true, name: 'uq_allocation_round_user' });
AllocationSchema.index({ status: 1, createdAt: 1 }, { name: 'ix_allocation_status_createdAt' });
AllocationSchema.index({ auctionId: 1, roundNo: 1, kind: 1 }, { name: 'ix_allocation_auction_round_kind' });
