import { BadRequestException, Injectable } from '@nestjs/common';
import { ClientSession, Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { RoundModel, RoundDocument } from './round.schema';

@Injectable()
export class RoundService {
  constructor(
    @InjectModel(RoundModel.name)
    private readonly roundModel: Model<RoundDocument>,
  ) {}

  async assertOpenRound(
    input: { auctionId: string; roundId: string },
    session?: ClientSession,
  ): Promise<RoundDocument> {
    const { auctionId, roundId } = input;

    const round = await this.roundModel
      .findOne({
        _id: new Types.ObjectId(roundId),
        auctionId: new Types.ObjectId(auctionId),
        status: 'OPEN',
      })
      .session(session ?? null);

    if (!round) {
      throw new BadRequestException('Round is not OPEN (or not found)');
    }
    return round;
  }

  async maybeExtendRound(
    round: RoundDocument,
    antiSnipe: { windowSec: number; extendSec: number; maxTotalExtendSec: number },
    session?: ClientSession,
  ): Promise<{ extended: boolean; newEndAt?: Date }> {
    const now = Date.now();
    const endAt = new Date(round.endAt).getTime();

    const windowMs = antiSnipe.windowSec * 1000;
    const extendMs = antiSnipe.extendSec * 1000;

    const totalExtendedSec = Number(round.antiSnipe?.totalExtendedSec ?? 0);
    if (totalExtendedSec >= antiSnipe.maxTotalExtendSec) return { extended: false };

    // не в окне анти-снайпа
    if (now < endAt - windowMs) return { extended: false };

    const nextTotal = totalExtendedSec + antiSnipe.extendSec;
    if (nextTotal > antiSnipe.maxTotalExtendSec) return { extended: false };

    const newEndAt = new Date(endAt + extendMs);

    // CAS: обновляем только если endAt не менялся
    const updated = await this.roundModel.findOneAndUpdate(
      { _id: round._id, status: 'OPEN', endAt: round.endAt },
      {
        $set: { endAt: newEndAt },
        $inc: { 'antiSnipe.totalExtendedSec': antiSnipe.extendSec },
      },
      { new: true, session: session ?? undefined },
    );

    if (!updated) return { extended: false };
    return { extended: true, newEndAt: updated.endAt };
  }
}
