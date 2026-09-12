import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PresencialClassesController } from './presencial-classes.controller';
import { PresencialClassesService } from './presencial-classes.service';
import { PresencialEmailService } from './presencial-email.service';
import { PrismaService } from '../../shared/services';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ConfigModule, ChatModule],
  controllers: [PresencialClassesController],
  providers: [PresencialClassesService, PresencialEmailService, PrismaService],
  exports: [PresencialClassesService],
})
export class PresencialClassesModule {}
