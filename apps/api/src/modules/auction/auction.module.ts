import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionModel, AuctionSchema } from './auction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuctionModel.name, schema: AuctionSchema }]),
    BullModule.registerQueue({ name: 'round-close' }),
  ],
  controllers: [AuctionController],
  providers: [AuctionService],
  exports: [AuctionService],
})
export class AuctionModule {}
