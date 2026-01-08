import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WalletModule } from '../wallet/wallet.module';
import { RoundModule } from '../round/round.module';

import { BidModel, BidSchema } from './bid.schema';
import { BidEventModel, BidEventSchema } from './bid-event.schema';
import { BidRepo } from './bid.repo';
import { BidEventRepo } from './bid-event.repo';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BidModel.name, schema: BidSchema },
      { name: BidEventModel.name, schema: BidEventSchema },
    ]),
    WalletModule,
    RoundModule,
  ],
  controllers: [BiddingController],
  providers: [BidRepo, BidEventRepo, BiddingService],
  exports: [BiddingService],
})
export class BiddingModule {}
