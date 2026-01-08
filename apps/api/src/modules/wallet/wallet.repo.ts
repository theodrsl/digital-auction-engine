import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model } from "mongoose";
import { WalletDocument, WalletModel } from "./wallet.schema";

@Injectable()
export class WalletRepo {
  constructor(
    @InjectModel(WalletModel.name)
    private readonly walletModel: Model<WalletModel>,
  ) {}

  async findByUserCurrency(
    userId: string,
    currency: string,
    session?: ClientSession,
  ): Promise<WalletDocument | null> {
    return this.walletModel.findOne({ userId, currency }).session(session ?? null).exec();
  }

  async ensureWallet(userId: string, currency: string, session: ClientSession): Promise<WalletDocument> {
    const doc = await this.walletModel
      .findOneAndUpdate(
        { userId, currency },
        { $setOnInsert: { userId, currency, available: 0, reserved: 0, version: 0 } },
        { upsert: true, new: true, session },
      )
      .exec();

    return doc;
  }

  async moveBalance(
    params: {
      userId: string;
      currency: string;
      incAvailable: number;
      incReserved: number;
      requireAvailableGte?: number;
      requireReservedGte?: number;
    },
    session: ClientSession,
  ): Promise<WalletDocument | null> {
    const { userId, currency, incAvailable, incReserved, requireAvailableGte, requireReservedGte } = params;

    const filter: Record<string, unknown> = { userId, currency };

    if (typeof requireAvailableGte === "number") {
      filter.available = { $gte: requireAvailableGte };
    }
    if (typeof requireReservedGte === "number") {
      filter.reserved = { $gte: requireReservedGte };
    }

    return this.walletModel
      .findOneAndUpdate(
        filter,
        { $inc: { available: incAvailable, reserved: incReserved, version: 1 } },
        { new: true, session },
      )
      .exec();
  }
}
