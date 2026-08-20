import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MentorshipEmailService } from './mentorship-email.service';
import { PrismaService } from '../../shared/services';

@Module({
  imports: [ConfigModule],
  controllers: [MentorshipController],
  providers: [
    MentorshipService,
    GoogleCalendarService,
    MentorshipEmailService,
    PrismaService,
  ],
  exports: [MentorshipService],
})
export class MentorshipModule {}
