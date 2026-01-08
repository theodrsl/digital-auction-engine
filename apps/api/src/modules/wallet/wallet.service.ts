import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { WalletDocument, WalletModel } from './wallet.schema';
import { LedgerEntryDocument, LedgerEntryModel } from './ledger.schema';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(WalletModel.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntryModel.name)
    private readonly ledgerModel: Model<LedgerEntryDocument>,
  ) {}

  async reserveForBid(
    input: {
      userId: string;
      currency: string;
      amount: number;
      auctionId: string;
      roundId: string;
      bidEventId: string;
    },
    session?: ClientSession,
  ): Promise<void> {
    if (input.amount <= 0) throw new BadRequestException('reserve amount must be > 0');

    const entryKey = `reserve:${input.auctionId}:${input.userId}:${input.bidEventId}`;

    // 1) ledger (unique)
    try {
      await this.ledgerModel.create(
        [
          {
            entryKey,
            userId: input.userId,
            currency: input.currency,
            type: 'RESERVE',
            amount: input.amount,
            from: 'AVAILABLE',
            to: 'RESERVED',
            auctionId: input.auctionId,
            roundId: input.roundId,
            bidEventId: input.bidEventId,
          },
        ],
        { session: session ?? undefined },
      );
    } catch (e: any) {
      // если это повтор (idempotency) — просто выходим
      if (String(e?.code) === '11000') return;
      throw e;
    }

    // 2) wallet atomic move
    const res = await this.walletModel.updateOne(
      { userId: input.userId, currency: input.currency, available: { $gte: input.amount } },
      { $inc: { available: -input.amount, reserved: input.amount, version: 1 } },
      { session: session ?? undefined },
    );

    if (res.modifiedCount !== 1) {
      throw new BadRequestException('Insufficient funds');
    }
  }
}
