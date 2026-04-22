import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatEmailService } from './chat-email.service';
import { PrismaService } from '../../shared/services';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'default-secret',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatEmailService, PrismaService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
