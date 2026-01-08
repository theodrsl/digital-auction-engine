import { IsInt, IsNotEmpty, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsInt()
  @IsPositive()
  roundDurationSec!: number;

  @IsInt()
  @IsPositive()
  winnersPerRound!: number;

  @IsInt()
  @IsPositive()
  maxRounds!: number;

  @ValidateNested()
  @Type(() => AntiSnipeDto)
  antiSnipe!: AntiSnipeDto;
}
