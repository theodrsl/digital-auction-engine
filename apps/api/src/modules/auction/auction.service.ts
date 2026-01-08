import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { AuctionModel, AuctionDocument, AuctionStatus } from './auction.schema';
import { CreateAuctionDto } from './dto/create-auction.dto';

// IMPORTANT: keep jobId without ":" (BullMQ restriction)
function closeRoundJobId(roundId: string) {
  return `round-close__${roundId}`;
}

type ListParams = {
  status?: string;
  currency?: string;
  limit: number;
  skip: number;
};

function asObjectIdOrNull(id: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

@Injectable()
export class AuctionService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(AuctionModel.name) private readonly auctions: Model<AuctionDocument>,
    @InjectQueue('round-close') private readonly roundCloseQueue: Queue,
  ) {}

  /**
   * MVP: create auction + immediately create Round#1 and schedule round-close job.
   * Это делает проект "живым" без отдельного UI/flow.
   */
  async create(dto: CreateAuctionDto) {
    const now = new Date();

    const startAt = now;
    const endAt = new Date(now.getTime() + dto.roundDurationSec * 1000);

    const auctionId = new Types.ObjectId();
    const roundId = new Types.ObjectId();

    const roundsCol = this.conn.collection('rounds');

    await this.conn.transaction(async (session) => {
      await this.auctions.create(
        [
          {
            _id: auctionId,
            currency: dto.currency,
            status: 'LIVE' satisfies AuctionStatus,
            activeRoundId: roundId.toString(),
            activeRoundNo: 1,
            roundConfig: {
              roundDurationSec: dto.roundDurationSec,
              winnersPerRound: dto.winnersPerRound,
              maxRounds: dto.maxRounds,
              antiSnipe: {
                windowSec: dto.antiSnipe.windowSec,
                extendSec: dto.antiSnipe.extendSec,
                maxTotalExtendSec: dto.antiSnipe.maxTotalExtendSec,
              },
            },
          },
        ],
        { session },
      );

      await roundsCol.insertOne(
        {
          _id: roundId,
          auctionId: auctionId, // ObjectId в rounds — удобно для агрегаций
          no: 1,
          status: 'OPEN',
          startAt,
          endAt,
          antiSnipe: { totalExtendedSec: 0 },
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
    });

    await this.ensureRoundCloseJob(roundId.toString(), endAt);

    return {
      auctionId: auctionId.toString(),
      activeRoundId: roundId.toString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  async list(params: ListParams) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = Math.max(params.skip ?? 0, 0);

    const query: Record<string, any> = {};
    if (params.status) query.status = params.status;
    if (params.currency) query.currency = params.currency;

    const rows = await this.auctions
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      items: rows.map((a) => ({
        id: a._id.toString(),
        currency: a.currency,
        status: a.status,
        activeRoundId: a.activeRoundId,
        activeRoundNo: a.activeRoundNo,
        roundConfig: a.roundConfig,
      })),
      page: { skip, limit },
    };
  }

  /**
   * Идемпотентный "start".
   * Для текущего MVP: аукцион уже создаётся LIVE с Round#1.
   * Но endpoint полезен для демо/UI и для будущего, когда сделаешь DRAFT.
   */
  async start(auctionId: string) {
    const auction = await this.auctions.findById(auctionId);
    if (!auction) throw new NotFoundException('Auction not found');

    // Если уже LIVE — просто гарантируем, что close-job существует
    if (auction.status === 'LIVE') {
      const roundsCol = this.conn.collection('rounds');
      const round = await roundsCol.findOne({
        _id: new Types.ObjectId(auction.activeRoundId),
      });

      if (round?.endAt) {
        await this.ensureRoundCloseJob(auction.activeRoundId, new Date(round.endAt));
      }

      return this.getById(auctionId);
    }

    // Если когда-то появится DRAFT — можно будет тут создавать первый раунд.
    // Сейчас просто переводим в LIVE без изменения раунда (чтобы не ломать схему).
    auction.status = 'LIVE';
    await auction.save();

    return this.getById(auctionId);
  }

  async getById(auctionId: string) {
    const auction = await this.auctions.findById(auctionId).lean();
    if (!auction) throw new NotFoundException('Auction not found');

    const roundsCol = this.conn.collection('rounds');
    const roundObjectId = asObjectIdOrNull(auction.activeRoundId);
    const round = roundObjectId ? await roundsCol.findOne({ _id: roundObjectId }) : null;

    return {
      auction: {
        id: auction._id.toString(),
        currency: auction.currency,
        status: auction.status,
        activeRoundId: auction.activeRoundId,
        activeRoundNo: auction.activeRoundNo,
        roundConfig: auction.roundConfig,
      },
      activeRound: round
        ? {
            id: round._id.toString(),
            auctionId: round.auctionId?.toString?.() ?? String(round.auctionId),
            no: round.no,
            status: round.status,
            startAt: round.startAt,
            endAt: round.endAt,
            antiSnipe: round.antiSnipe,
            closedAt: round.closedAt ?? null,
          }
        : null,
    };
  }

  /**
   * Лидерборд по текущим "active" ставкам:
   * сортируем по amount desc, tie-breaker по lastBidAt asc (кто раньше достиг — выше).
   *
   * Важно: в разных частях проекта auctionId может быть string или ObjectId.
   * Поэтому матчим оба варианта.
   */
  async leaderboard(auctionId: string, limit = 20) {
    const bidsCol = this.conn.collection('bids');
    const capped = Math.min(Math.max(limit ?? 20, 1), 200);

    const auctionObjectId = asObjectIdOrNull(auctionId);

    const match: any = {
      status: { $in: ['ACTIVE', null] },
      $or: [{ auctionId: auctionId }],
    };

    if (auctionObjectId) match.$or.push({ auctionId: auctionObjectId });

    const rows = await bidsCol
      .find(match)
      .project({ _id: 0, userId: 1, amount: 1, lastBidAt: 1, currency: 1 })
      .sort({ amount: -1, lastBidAt: 1 })
      .limit(capped)
      .toArray();

    return { auctionId, items: rows };
  }

  private async ensureRoundCloseJob(roundId: string, endAt: Date) {
    const delayMs = Math.max(0, endAt.getTime() - Date.now());

    // jobId фиксированный → add будет идемпотентен (не создаст дубль)
    await this.roundCloseQueue.add(
      'close-round',
      { roundId },
      {
        jobId: closeRoundJobId(roundId),
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 200,
        attempts: 5,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
  }
}
