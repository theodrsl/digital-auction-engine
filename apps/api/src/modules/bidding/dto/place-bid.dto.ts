import { IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';

export class PlaceBidDto {
  @IsString()
  @IsNotEmpty()
  auctionId!: string;

  @IsString()
  @IsNotEmpty()
  roundId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
