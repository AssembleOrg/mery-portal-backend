import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { AuditModule } from './modules/audit';
import { EmailModule } from './modules/email';
import { VimeoModule } from './modules/vimeo';
import { VideosModule } from './modules/videos';
import { CategoriesModule } from './modules/categories';
import { CartModule } from './modules/cart';
import { PrismaService } from './shared/services';
import { GlobalExceptionFilter } from './common/filters';
import { ResponseInterceptor, LoggingInterceptor } from './shared/interceptors';
import { SuspiciousActivityGuard } from './shared/guards';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutes
        limit: 500, // 500 requests per 15 minutes
      },
    ]),
    AuthModule,
    UsersModule,
    AuditModule,
    EmailModule,
    VimeoModule,
    VideosModule,
    CategoriesModule,
    CartModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SuspiciousActivityGuard,
    },
  ],
})
export class AppModule {}
