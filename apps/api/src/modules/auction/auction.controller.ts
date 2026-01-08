import { Controller, Get, Param, ParseIntPipe, Post, Query, Body } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly service: AuctionService) {}

  @Post()
  create(@Body() dto: CreateAuctionDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/leaderboard')
  leaderboard(
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.leaderboard(id, limit ?? 20);
  }
}
