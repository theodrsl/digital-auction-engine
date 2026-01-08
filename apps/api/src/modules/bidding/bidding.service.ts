import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

import { BidRepo } from './bid.repo';
import { BidEventRepo } from './bid-event.repo';
import { WalletService } from '../wallet/wallet.service';
import { RoundService } from '../round/round.service';

export type PlaceBidResult = {
  bidId: string;
  prevAmount: number;
  newAmount: number;
  delta: number;
  roundExtended: boolean;
  newRoundEndAt?: Date;
};

@Injectable()
export class BiddingService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly bidRepo: BidRepo,
    private readonly bidEventRepo: BidEventRepo,
    private readonly walletService: WalletService,
    private readonly roundService: RoundService,
  ) {}

  async placeBid(input: {
    auctionId: string;
    roundId: string;
    userId: string;
    currency: string;
    amount: number;
    idempotencyKey: string;
    antiSnipe: { windowSec: number; extendSec: number; maxTotalExtendSec: number };
  }): Promise<PlaceBidResult> {
    const { auctionId, roundId, userId, currency, amount, idempotencyKey } = input;

    if (!auctionId || !roundId || !userId || !currency || !idempotencyKey) {
      throw new BadRequestException('Missing fields');
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be positive int');
    }

    try {
      return await this.conn.transaction(async (session: ClientSession) => {
        const round = await this.roundService.assertOpenRound({ auctionId, roundId }, session);

        // idem
        const existingEvent = await this.bidEventRepo.findByIdempotency(
          { auctionId, userId, idempotencyKey },
          session,
        );
        if (existingEvent) {
          return {
            bidId: '',
            prevAmount: existingEvent.prevAmount,
            newAmount: existingEvent.amount,
            delta: existingEvent.delta,
            roundExtended: false,
          };
        }

        const current = await this.bidRepo.findActive({ auctionId, userId }, session);
        const prevAmount = current?.amount ?? 0;

        if (amount <= prevAmount) {
          throw new BadRequestException(`amount must be > prevAmount (${prevAmount})`);
        }

        const delta = amount - prevAmount;

        const ext = await this.roundService.maybeExtendRound(round, input.antiSnipe, session);

        const bidEvent = await this.bidEventRepo.create(
          {
            auctionId,
            roundId,
            userId,
            currency,
            amount,
            prevAmount,
            delta,
            idempotencyKey,
          },
          session,
        );

        await this.walletService.reserveForBid(
          {
            userId,
            currency,
            amount: delta,
            auctionId,
            roundId,
            bidEventId: String(bidEvent._id),
          },
          session,
        );

        const bid = await this.bidRepo.upsertActive(
          { auctionId, userId, roundId, currency, amount, lastBidAt: new Date() },
          session,
        );

        return {
          bidId: String(bid._id),
          prevAmount,
          newAmount: amount,
          delta,
          roundExtended: ext.extended,
          ...(ext.extended ? { newRoundEndAt: ext.newEndAt } : {}),
        };
      });
    } catch (e: any) {
      throw new InternalServerErrorException(e?.message ?? 'Internal server error');
    }
  }
}
