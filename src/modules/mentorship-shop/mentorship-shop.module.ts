import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/services';
import { MentorshipModule } from '../mentorship/mentorship.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { MentorshipShopController } from './mentorship-shop.controller';
import { MentorshipShopService } from './mentorship-shop.service';

@Module({
  imports: [
    ConfigModule,
    MentorshipModule,
    NotificationsModule,
    SettingsModule,
    StorageModule,
  ],
  controllers: [MentorshipShopController],
  providers: [MentorshipShopService, PrismaService],
  exports: [MentorshipShopService],
})
export class MentorshipShopModule {}
