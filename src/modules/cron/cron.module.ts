import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/services';
import { CouponsModule } from '../coupons';
import { ChatModule } from '../chat';
import { MentorshipModule } from '../mentorship/mentorship.module';

@Module({
  imports: [ScheduleModule.forRoot(), CouponsModule, ChatModule, MentorshipModule],
  providers: [CronService, PrismaService],
  exports: [CronService],
})
export class CronModule {}

