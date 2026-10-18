import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MentorshipController } from './mentorship.controller';
import {
  MentorshipIntegrationController,
  MentorshipIntegrationGuard,
} from './mentorship-integration.controller';
import { MentorshipService } from './mentorship.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MentorshipEmailService } from './mentorship-email.service';
import { MentorshipWhatsappAlertService } from './mentorship-whatsapp-alert.service';
import { PrismaService } from '../../shared/services';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, ChatModule, NotificationsModule, StorageModule],
  controllers: [MentorshipController, MentorshipIntegrationController],
  providers: [
    MentorshipService,
    GoogleCalendarService,
    MentorshipEmailService,
    MentorshipWhatsappAlertService,
    MentorshipIntegrationGuard,
    PrismaService,
  ],
  exports: [MentorshipService],
})
export class MentorshipModule {}
