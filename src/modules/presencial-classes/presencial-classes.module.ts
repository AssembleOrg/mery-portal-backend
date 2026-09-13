import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PresencialClassesController } from './presencial-classes.controller';
import { PresencialClassesService } from './presencial-classes.service';
import { PresencialEmailService } from './presencial-email.service';
import { PresencialDepositsService } from './presencial-deposits.service';
import { DollarRateService } from './dollar-rate.service';
import { PrismaService } from '../../shared/services';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ConfigModule, ChatModule, NotificationsModule, SettingsModule],
  controllers: [PresencialClassesController],
  providers: [
    PresencialClassesService,
    PresencialEmailService,
    PresencialDepositsService,
    DollarRateService,
    PrismaService,
  ],
  exports: [PresencialClassesService, PresencialDepositsService, DollarRateService],
})
export class PresencialClassesModule {}
