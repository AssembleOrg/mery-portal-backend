import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/services';
import { CouponsModule } from '../coupons';

@Module({
  imports: [ScheduleModule.forRoot(), CouponsModule],
  providers: [CronService, PrismaService],
  exports: [CronService],
})
export class CronModule {}

