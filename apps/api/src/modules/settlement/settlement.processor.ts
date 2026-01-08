import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { QUEUE_SETTLEMENT, JOB_SETTLE_ALLOCATION } from '../jobs/queues';
import { AllocationDocument, AllocationModel } from './allocation.schema';

@Processor(QUEUE_SETTLEMENT)
export class SettlementProcessor extends WorkerHost {
  constructor(
    @InjectModel(AllocationModel.name) private readonly allocationModel: Model<AllocationDocument>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOB_SETTLE_ALLOCATION) return;

    const { allocationId } = job.data as { allocationId: string };

    // skeleton: idempotent state machine
    const allocation = await this.allocationModel.findById(allocationId);
    if (!allocation) return;

    if (allocation.status === 'SETTLED') return;

    // TODO: move money via WalletService (CAPTURE for WIN, RELEASE for CARRY)
    allocation.status = 'SETTLED';
    allocation.settlementId = allocation.settlementId ?? `settle:${allocation._id.toString()}`;
    await allocation.save();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // TODO: structured logging
    // console.error(`[settlement] failed job=${job.id}`, err);
  }
}
