import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { JobsModule } from '../jobs/jobs.module';
import { SettlementModule } from '../settlement/settlement.module';

import { RoundModel, RoundSchema } from './round.schema';
import { RoundService } from './round.service';
import { RoundCloseScheduler } from './round-close.scheduler';
import { RoundCloseProcessor } from './round-close.processor';

import { BidModel, BidSchema } from '../bidding/bid.schema';
import { AllocationModel, AllocationSchema } from '../settlement/allocation.schema';

@Module({
  imports: [
    JobsModule,
    SettlementModule,

    MongooseModule.forFeature([
      { name: RoundModel.name, schema: RoundSchema },
      { name: BidModel.name, schema: BidSchema },
      { name: AllocationModel.name, schema: AllocationSchema },
    ]),
  ],
  providers: [RoundService, RoundCloseScheduler, RoundCloseProcessor],
  exports: [RoundService, RoundCloseScheduler],
})
export class RoundModule {}
