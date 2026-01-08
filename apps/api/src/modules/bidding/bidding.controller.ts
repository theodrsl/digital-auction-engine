import { Body, Controller, Post } from '@nestjs/common';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BiddingService } from './bidding.service';

@Controller('bids')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  @Post()
  async placeBid(@Body() dto: PlaceBidDto) {
    return this.biddingService.placeBid({
      auctionId: dto.auctionId,
      roundId: dto.roundId,
      userId: dto.userId,
      currency: dto.currency,
      amount: dto.amount,
      idempotencyKey: dto.idempotencyKey,
      antiSnipe: {
        windowSec: 10,
        extendSec: 10,
        maxTotalExtendSec: 60,
      },
    });
  }
}
