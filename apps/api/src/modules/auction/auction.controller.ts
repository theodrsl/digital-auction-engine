import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly service: AuctionService) {}

  // POST /auctions
  @Post()
  create(@Body() dto: CreateAuctionDto) {
    return this.service.create(dto);
  }

  // GET /auctions?status=LIVE&currency=USD&limit=50&skip=0
  @Get()
  list(
    @Query('status') status?: string,
    @Query('currency') currency?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
  ) {
    return this.service.list({
      status,
      currency,
      limit: limit ?? 50,
      skip: skip ?? 0,
    });
  }

  // POST /auctions/:id/start  (идемпотентно)
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.service.finish(id);
  }

  // GET /auctions/:id
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  // GET /auctions/:id/leaderboard?limit=20
  @Get(':id/leaderboard')
  leaderboard(
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.leaderboard(id, limit ?? 20);
  }
}
