import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { QUEUE_ROUND_CLOSE, JOB_CLOSE_ROUND, closeRoundJobId } from '../jobs/queues';

@Injectable()
export class RoundCloseScheduler {
  constructor(@InjectQueue(QUEUE_ROUND_CLOSE) private readonly queue: Queue) {}

  async scheduleClose(roundId: string, endAt: Date) {
    const delay = Math.max(0, endAt.getTime() - Date.now());

    await this.queue.add(
      JOB_CLOSE_ROUND,
      { roundId },
      {
        jobId: closeRoundJobId(roundId),
        delay,
        removeOnComplete: true,
        removeOnFail: 200,
        attempts: 10,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }
}
