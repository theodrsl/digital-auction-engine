import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { WalletModel, WalletSchema } from "./wallet.schema";
import { LedgerEntryModel, LedgerEntrySchema } from "./ledger.schema";
import { WalletRepo } from "./wallet.repo";
import { LedgerRepo } from "./ledger.repo";
import { WalletService } from "./wallet.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletModel.name, schema: WalletSchema },
      { name: LedgerEntryModel.name, schema: LedgerEntrySchema },
    ]),
  ],
  providers: [WalletRepo, LedgerRepo, WalletService],
  exports: [WalletService],
})
export class WalletModule {}
