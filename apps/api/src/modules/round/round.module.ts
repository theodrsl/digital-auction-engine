import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RoundModel, RoundSchema } from './round.schema';
import { RoundService } from './round.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RoundModel.name, schema: RoundSchema }]),
  ],
  providers: [RoundService],
  exports: [RoundService, MongooseModule],
})
export class RoundModule {}
