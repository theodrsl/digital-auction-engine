import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class AntiSnipeDto {
  @IsInt()
  @Min(0)
  windowSec!: number;

  @IsInt()
  @Min(0)
  extendSec!: number;

  @IsInt()
  @Min(0)
  maxTotalExtendSec!: number;
}

class AuctionItemDto {
  @IsIn(['TELEGRAM_GIFT', 'NFT'])
  kind!: 'TELEGRAM_GIFT' | 'NFT';

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsInt()
  @Min(1)
  totalSupply!: number;
}

export class CreateAuctionDto {
  @IsString()
  currency!: string;

  @IsInt()
  @Min(1)
  roundDurationSec!: number;

  @IsInt()
  @Min(1)
  winnersPerRound!: number;

  @IsInt()
  @Min(1)
  maxRounds!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => AntiSnipeDto)
  antiSnipe!: AntiSnipeDto;

  /**
   * Prize (gift/NFT). Optional for backward compatibility.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuctionItemDto)
  item?: AuctionItemDto;
}
