import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RewardsService } from './rewards.service';
import { RewardEmailService } from './reward-email.service';
import { PrismaService } from '../../shared/services';

@Module({
  imports: [ConfigModule],
  providers: [RewardsService, RewardEmailService, PrismaService],
  exports: [RewardsService],
})
export class RewardsModule {}
