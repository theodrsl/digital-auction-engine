import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import { QUEUE_SETTLEMENT } from '../jobs/queues';
import { JobsModule } from '../jobs/jobs.module';

import { AllocationModel, AllocationSchema } from './allocation.schema';
import { SettlementProcessor } from './settlement.processor';
import { WalletModel, WalletSchema } from '../wallet/wallet.schema';

@Module({
  imports: [
    JobsModule,
    BullModule.registerQueue({ name: QUEUE_SETTLEMENT }),
    MongooseModule.forFeature([
      { name: AllocationModel.name, schema: AllocationSchema },
      { name: WalletModel.name, schema: WalletSchema },
    ]),
  ],
  providers: [SettlementProcessor],
})
export class SettlementModule {}
