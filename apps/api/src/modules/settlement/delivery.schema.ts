import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliveryDocument = DeliveryModel & Document;

export type DeliveryStatus = 'CREATING' | 'DELIVERED' | 'FAILED_SUPPLY';

@Schema({ collection: 'deliveries', timestamps: true })
export class DeliveryModel {
  @Prop({ required: true })
  deliveryKey!: string;

  @Prop({ required: true })
  auctionId!: string;

  @Prop({ required: true })
  roundId!: string;

  @Prop({ required: true })
  allocationId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  itemKind!: string;

  @Prop({ required: true })
  itemName!: string;

  @Prop()
  itemCollection?: string;

  @Prop({ required: true, min: 1 })
  units!: number;

  @Prop({ required: true, enum: ['CREATING', 'DELIVERED', 'FAILED_SUPPLY'] })
  status!: DeliveryStatus;

  @Prop()
  supplySeq?: number;

  @Prop()
  failReason?: string;
}

export const DeliverySchema = SchemaFactory.createForClass(DeliveryModel);

DeliverySchema.index({ deliveryKey: 1 }, { unique: true, name: 'uq_delivery_key' });
DeliverySchema.index({ auctionId: 1, createdAt: 1 }, { name: 'ix_delivery_auction_createdAt' });
DeliverySchema.index({ allocationId: 1 }, { unique: true, name: 'uq_delivery_allocation' });
