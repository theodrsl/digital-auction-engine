import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WalletModule } from './modules/wallet/wallet.module';
import { RoundModule } from './modules/round/round.module';
import { BiddingModule } from './modules/bidding/bidding.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { SettlementModule } from './modules/settlement/settlement.module';

@Module({
  imports: [
    // MongoDB (Replica Set, transactions)
    MongooseModule.forRoot(process.env.MONGO_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGO_DB ?? 'digital_auction',
    }),

    // Infrastructure
    JobsModule,        // BullMQ + Redis connection
    SettlementModule,  // Allocation + settlement workers

    // Domain modules
    WalletModule,
    RoundModule,
    BiddingModule,
  ],
})
export class AppModule {}
