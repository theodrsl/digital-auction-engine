import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WalletDocument = HydratedDocument<WalletModel>;

@Schema({ collection: "wallets", timestamps: true })
export class WalletModel {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true, default: 0 })
  available!: number;

  @Prop({ type: Number, required: true, default: 0 })
  reserved!: number;

  @Prop({ type: Number, required: true, default: 0 })
  version!: number;
}

export const WalletSchema = SchemaFactory.createForClass(WalletModel);

WalletSchema.index({ userId: 1, currency: 1 }, { unique: true });
WalletSchema.index({ userId: 1, currency: 1, available: 1 });
