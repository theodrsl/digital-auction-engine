import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { QUEUE_ROUND_CLOSE, QUEUE_SETTLEMENT } from './queues';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),

    BullModule.registerQueue({ name: QUEUE_ROUND_CLOSE }),
    BullModule.registerQueue({ name: QUEUE_SETTLEMENT }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
