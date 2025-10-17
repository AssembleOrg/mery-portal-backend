import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/services';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronService, PrismaService],
  exports: [CronService],
})
export class CronModule {}

