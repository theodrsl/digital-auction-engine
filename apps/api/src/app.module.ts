import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WalletModule } from './modules/wallet/wallet.module';
import { RoundModule } from './modules/round/round.module';
import { BiddingModule } from './modules/bidding/bidding.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI ?? '', {
      dbName: process.env.MONGO_DB ?? 'digital_auction',
    }),

    WalletModule,
    RoundModule,
    BiddingModule,
  ],
})
export class AppModule {}
