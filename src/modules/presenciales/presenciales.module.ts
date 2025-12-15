import { Module } from '@nestjs/common';
import { PresencialesService } from './presenciales.service';
import { PresencialesController } from './presenciales.controller';
import { PrismaService } from '~/shared/services';

@Module({
  controllers: [PresencialesController],
  providers: [PresencialesService, PrismaService],
  exports: [PresencialesService],
})
export class PresencialesModule {}


