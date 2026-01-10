import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuctionDocument = HydratedDocument<AuctionModel>;

export type AuctionStatus = 'DRAFT' | 'LIVE' | 'FINISHED' | 'CANCELLED';

export type AuctionItemKind = 'TELEGRAM_GIFT' | 'NFT';

@Schema({ collection: 'auctions', timestamps: true })
export class AuctionModel {
  /**
   * Валюта ставок (например TON)
   */
  @Prop({ required: true })
  currency!: string;

  /**
   * Статус аукциона
   */
  @Prop({ required: true, default: 'LIVE' })
  status!: AuctionStatus;

  /**
   * Активный раунд (id как string для простоты API)
   */
  @Prop({ required: true })
  activeRoundId!: string;

  /**
   * Номер активного раунда (1-based)
   */
  @Prop({ required: true, default: 1 })
  activeRoundNo!: number;

  /**
   * Конфигурация раундов
   */
  @Prop({
    required: true,
    type: Object,
  })
  roundConfig!: {
    roundDurationSec: number;
    winnersPerRound: number;
    maxRounds: number;
    antiSnipe: {
      windowSec: number;
      extendSec: number;
      maxTotalExtendSec: number;
    };
  };

  /**
   * Цифровой товар / подарок, который разыгрывается
   * Деньги НЕ являются призом
   */
  @Prop({
    required: true,
    type: Object,
  })
  item!: {
    /**
     * Тип товара
     * TELEGRAM_GIFT — подарки в Telegram
     * NFT — условный NFT / digital collectible
     */
    kind: AuctionItemKind;

    /**
     * Человеко-читаемое имя
     * Например: "Golden Gift #2025"
     */
    name: string;

    /**
     * Опционально: коллекция / контракт / серия
     */
    collection?: string;

    /**
     * Общее количество доступных единиц
     * Обычно = winnersPerRound * maxRounds
     */
    totalSupply: number;
  };

  /**
   * Сколько единиц товара уже выдано (WIN allocations)
   * Используется для защиты от over-delivery
   */
  @Prop({ required: true, default: 0 })
  distributedSupply!: number;
}

export const AuctionSchema = SchemaFactory.createForClass(AuctionModel);

/**
 * Индексы
 */
AuctionSchema.index({ status: 1, currency: 1 });
AuctionSchema.index({ activeRoundId: 1 });
AuctionSchema.index({ 'item.kind': 1 });
