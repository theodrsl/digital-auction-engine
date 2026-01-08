import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { RoundDocument, RoundModel } from './round.schema';

type AssertOpenRoundInput = { auctionId: string; roundId: string };

@Injectable()
export class RoundService {
  constructor(@InjectModel(RoundModel.name) private readonly rounds: Model<RoundDocument>) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ObjectId: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Loads round by _id and validates:
   * - belongs to auctionId (string compare using toString())
   * - status === OPEN
   */
  async assertOpenRound(input: AssertOpenRoundInput, session: ClientSession) {
    const _id = this.toObjectId(input.roundId);

    const round = await this.rounds.findById(_id, null, { session }).lean();
    if (!round) throw new NotFoundException('Round not found');

    const roundAuctionId =
      (round as any).auctionId?.toString?.() ?? String((round as any).auctionId);

    if (roundAuctionId !== input.auctionId) {
      throw new BadRequestException('Round does not belong to auction');
    }

    if (round.status !== 'OPEN') {
      throw new BadRequestException(`Round is not OPEN (status=${round.status})`);
    }

    return round;
  }

  /**
   * Anti-sniping: extend endAt if within window and not over maxTotalExtendSec.
   * Works with session and returns whether extended + new endAt.
   */
  async maybeExtendRound(
    round: any,
    antiSnipe: { windowSec: number; extendSec: number; maxTotalExtendSec: number },
    session: ClientSession,
  ): Promise<{ extended: boolean; newEndAt?: Date }> {
    const now = new Date();
    const endAt = new Date(round.endAt);
    const totalExtendedSec = Number(round?.antiSnipe?.totalExtendedSec ?? 0);

    if (antiSnipe.windowSec <= 0 || antiSnipe.extendSec <= 0) return { extended: false };
    if (totalExtendedSec >= antiSnipe.maxTotalExtendSec) return { extended: false };

    const windowStart = new Date(endAt.getTime() - antiSnipe.windowSec * 1000);
    if (now < windowStart) return { extended: false };

    const remainingCap = antiSnipe.maxTotalExtendSec - totalExtendedSec;
    const addSec = Math.min(antiSnipe.extendSec, remainingCap);
    if (addSec <= 0) return { extended: false };

    const newEndAt = new Date(endAt.getTime() + addSec * 1000);

    const res = await this.rounds.updateOne(
      { _id: round._id, status: 'OPEN', endAt: endAt },
      { $set: { endAt: newEndAt }, $inc: { 'antiSnipe.totalExtendedSec': addSec } },
      { session },
    );

    if (res.modifiedCount === 1) {
      return { extended: true, newEndAt };
    }

    // If someone else updated endAt concurrently, we just return non-extended.
    return { extended: false };
  }
}
