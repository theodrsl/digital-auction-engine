import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { LedgerBalanceBucket, LedgerEntryType } from "@digital-auction/shared";

export type LedgerEntryDocument = HydratedDocument<LedgerEntryModel>;

@Schema({ collection: "ledger_entries", timestamps: { createdAt: true, updatedAt: false } })
export class LedgerEntryModel {
  @Prop({ type: String, required: true })
  entryKey!: string;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true, enum: Object.values(LedgerEntryType) })
  type!: LedgerEntryType;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, required: true, enum: Object.values(LedgerBalanceBucket) })
  from!: LedgerBalanceBucket;

  @Prop({ type: String, required: true, enum: Object.values(LedgerBalanceBucket) })
  to!: LedgerBalanceBucket;

  @Prop({ type: String })
  auctionId?: string;

  @Prop({ type: String })
  roundId?: string;

  @Prop({ type: String })
  bidId?: string;

  @Prop({ type: String })
  bidEventId?: string;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntryModel);

LedgerEntrySchema.index({ entryKey: 1 }, { unique: true });
LedgerEntrySchema.index({ userId: 1, currency: 1, createdAt: -1 });
LedgerEntrySchema.index({ auctionId: 1, roundId: 1, createdAt: -1 });
LedgerEntrySchema.index({ bidId: 1, createdAt: -1 });
