import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { RoundDocument, RoundModel } from './round.schema';
import { RoundStatus } from '@digital-auction/shared';

@Injectable()
export class RoundRepo {
  constructor(
    @InjectModel(RoundModel.name)
    private readonly roundModel: Model<RoundModel>,
  ) {}

  async findById(roundId: string, session?: ClientSession): Promise<RoundDocument | null> {
    return this.roundModel.findById(new Types.ObjectId(roundId)).session(session ?? null).exec();
  }

  /**
   * Anti-sniping extension: атомарно продлевает endAt, если раунд всё ещё OPEN
   * и если текущее endAt <= threshold (то есть мы действительно в "окне").
   */
  async maybeExtendEndAt(params: {
    roundId: string;
    now: Date;
    windowMs: number;
    extendMs: number;
    maxTotalExtendMs: number;
  }, session: ClientSession): Promise<{ extended: boolean; newEndAt?: Date }> {
    const { roundId, now, windowMs, extendMs, maxTotalExtendMs } = params;

    const roundObjectId = new Types.ObjectId(roundId);

    // Мы продлеваем только если осталось <= windowMs.
    // И не превышаем maxTotalExtendMs.
    const doc = await this.roundModel.findOneAndUpdate(
      {
        _id: roundObjectId,
        status: RoundStatus.OPEN,
        endAt: { $lte: new Date(now.getTime() + windowMs) },
        'antiSnipe.totalExtendedSec': { $lte: Math.floor(maxTotalExtendMs / 1000) - Math.floor(extendMs / 1000) },
      },
      {
        $set: { endAt: new Date(now.getTime() + extendMs + windowMs) }, // (см. ниже пояснение)
        $inc: { 'antiSnipe.totalExtendedSec': Math.floor(extendMs / 1000) },
      },
      { new: true, session },
    ).exec();

    if (!doc) return { extended: false };
    return { extended: true, newEndAt: doc.endAt };
  }
}
