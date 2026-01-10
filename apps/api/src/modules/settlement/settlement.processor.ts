import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { QUEUE_SETTLEMENT, JOB_SETTLE_ALLOCATION } from '../jobs/queues';
import { AllocationDocument, AllocationModel } from './allocation.schema';
import { WalletDocument, WalletModel } from '../wallet/wallet.schema';
import { LedgerEntryDocument, LedgerEntryModel } from '../wallet/ledger.schema';
import { DeliveryDocument, DeliveryModel } from './delivery.schema';
import { AuctionDocument, AuctionModel } from '../auction/auction.schema';

@Processor(QUEUE_SETTLEMENT)
export class SettlementProcessor extends WorkerHost {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(AllocationModel.name) private readonly allocationModel: Model<AllocationDocument>,
    @InjectModel(WalletModel.name) private readonly walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntryModel.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(DeliveryModel.name) private readonly deliveryModel: Model<DeliveryDocument>,
    @InjectModel(AuctionModel.name) private readonly auctionModel: Model<AuctionDocument>,
  ) {
    super();
  }

  private async deliverPrizeOnce(params: {
    allocationId: string;
    auctionId: string;
    roundId: string;
    userId: string;
  }) {
    const { allocationId, auctionId, roundId, userId } = params;

    const auction = await this.auctionModel.findById(auctionId).lean();
    const item = (auction as any)?.item;

    const itemKind = String(item?.kind || 'TELEGRAM_GIFT');
    const itemName = String(item?.name || 'Limited Gift');
    const itemCollection = item?.collection ? String(item.collection) : undefined;

    const totalSupply = Number(item?.totalSupply ?? 0);
    const key = `deliver:${allocationId}`;

    const delivery = await this.deliveryModel.findOneAndUpdate(
      { deliveryKey: key },
      {
        $setOnInsert: {
          deliveryKey: key,
          auctionId,
          roundId,
          allocationId,
          userId,
          itemKind,
          itemName,
          itemCollection,
          units: 1,
          status: 'CREATING',
        },
      },
      { upsert: true, new: true },
    );

    if (!delivery) return;

    const status = String((delivery as any).status || '');
    const supplySeqExisting = (delivery as any).supplySeq;

    if (status === 'DELIVERED') return;

    if (Number.isFinite(supplySeqExisting) && Number(supplySeqExisting) > 0) {
      await this.deliveryModel.updateOne(
        { deliveryKey: key, status: { $ne: 'DELIVERED' } },
        { $set: { status: 'DELIVERED' }, $unset: { failReason: 1 } },
      );
      return;
    }

    let seq = 0;

    if (Number.isFinite(totalSupply) && totalSupply > 0) {
      const res = await this.auctionModel.findOneAndUpdate(
        { _id: auctionId, distributedSupply: { $lt: totalSupply } },
        { $inc: { distributedSupply: 1 } },
        { new: true },
      );

      if (!res) {
        await this.deliveryModel.updateOne(
          { deliveryKey: key, status: { $ne: 'DELIVERED' } },
          { $set: { status: 'FAILED_SUPPLY', failReason: `supply exhausted totalSupply=${totalSupply}` } },
        );
        throw new Error(`[delivery] supply exhausted auction=${auctionId} totalSupply=${totalSupply}`);
      }

      seq = Number((res as any).distributedSupply ?? 0);
    } else {
      const res2 = await this.auctionModel.findOneAndUpdate(
        { _id: auctionId },
        { $inc: { distributedSupply: 1 } },
        { new: true },
      );
      seq = Number((res2 as any)?.distributedSupply ?? 0);
    }

    await this.deliveryModel.updateOne(
      { deliveryKey: key, status: { $ne: 'DELIVERED' }, supplySeq: { $exists: false } },
      { $set: { supplySeq: seq, status: 'DELIVERED' }, $unset: { failReason: 1 } },
    );

    await this.deliveryModel.updateOne(
      { deliveryKey: key, status: { $ne: 'DELIVERED' }, supplySeq: { $exists: true } },
      { $set: { status: 'DELIVERED' }, $unset: { failReason: 1 } },
    );
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOB_SETTLE_ALLOCATION) return;

    const { roundId, userId } = job.data as { roundId: string; userId: string };
    if (!roundId || !userId) return;

    const allocation = await this.allocationModel.findOneAndUpdate(
      { roundId: String(roundId), userId: String(userId), status: { $in: ['PENDING', 'FAILED'] } },
      { $set: { status: 'SETTLING' } },
      { new: true },
    );

    if (!allocation) return;

    const allocationId = allocation._id.toString();

    try {
      const finalAmount = Math.max(0, Number((allocation as any).finalAmount ?? 0));
      const op = allocation.kind === 'WIN' ? 'CAPTURE' : 'RELEASE';
      const entryKey = `settle:${allocationId}:${op}`;

      if (finalAmount > 0) {
        try {
          await this.ledgerModel.create({
            entryKey,
            userId: allocation.userId,
            currency: allocation.currency,
            type: op,
            amount: finalAmount,
            from: 'RESERVED',
            to: allocation.kind === 'WIN' ? 'SINK' : 'AVAILABLE',
            auctionId: allocation.auctionId,
            roundId: allocation.roundId,
            meta: {
              allocationId,
              allocationKind: allocation.kind,
              finalAmount,
              at: new Date().toISOString(),
            },
          });
        } catch (e: any) {
          if (String(e?.code) !== '11000') throw e;
        }

        if (allocation.kind === 'WIN') {
          const res = await this.walletModel.updateOne(
            { userId: allocation.userId, currency: allocation.currency, reserved: { $gte: finalAmount } },
            { $inc: { reserved: -finalAmount, version: 1 } },
          );
          if (res.modifiedCount !== 1) {
            throw new Error(
              `[settlement] CAPTURE wallet move failed user=${allocation.userId} round=${allocation.roundId} amount=${finalAmount}`,
            );
          }
        } else {
          const res = await this.walletModel.updateOne(
            { userId: allocation.userId, currency: allocation.currency, reserved: { $gte: finalAmount } },
            { $inc: { reserved: -finalAmount, available: finalAmount, version: 1 } },
          );
          if (res.modifiedCount !== 1) {
            throw new Error(
              `[settlement] RELEASE wallet move failed user=${allocation.userId} round=${allocation.roundId} amount=${finalAmount}`,
            );
          }
        }
      }

      if (allocation.kind === 'WIN') {
        await this.deliverPrizeOnce({
          allocationId,
          auctionId: String(allocation.auctionId),
          roundId: String(allocation.roundId),
          userId: String(allocation.userId),
        });
      }

      await this.allocationModel.updateOne(
        { _id: allocation._id, status: 'SETTLING' },
        { $set: { status: 'SETTLED', settlementId: (allocation as any).settlementId ?? `settle:${allocationId}` } },
      );
    } catch (e) {
      try {
        await this.allocationModel.updateOne(
          { _id: allocationId, status: { $ne: 'SETTLED' } },
          { $set: { status: 'FAILED' } },
        );
      } catch (_) {}
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {}
}
