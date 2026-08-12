import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/services';
import { CouponsModule } from '../coupons';
import { ChatModule } from '../chat';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [ScheduleModule.forRoot(), CouponsModule, ChatModule, PromoModule],
  providers: [CronService, PrismaService],
  exports: [CronService],
})
export class CronModule {}

