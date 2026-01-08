import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model } from "mongoose";
import { LedgerEntryModel } from "./ledger.schema";

@Injectable()
export class LedgerRepo {
  constructor(
    @InjectModel(LedgerEntryModel.name)
    private readonly ledgerModel: Model<LedgerEntryModel>,
  ) {}

  async createEntry(entry: Omit<LedgerEntryModel, "_id">, session: ClientSession): Promise<void> {
    await this.ledgerModel.create([entry], { session });
  }
}
