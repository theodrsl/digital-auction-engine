import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeliveryModel, DeliveryDocument } from './delivery.schema';

@Controller()
export class InventoryController {
  constructor(
    @InjectModel(DeliveryModel.name) private readonly deliveryModel: Model<DeliveryDocument>,
  ) {}

  @Get('/inventory/:userId')
  async getInventory(
    @Param('userId') userId: string,
    @Query('auctionId') auctionId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw || 50), 1), 200);

    const filter: any = { userId };
    if (auctionId) filter.auctionId = auctionId;

    const items = await this.deliveryModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return { items };
  }
}
