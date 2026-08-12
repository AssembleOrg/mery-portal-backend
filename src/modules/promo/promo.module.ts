import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';
import { PromoEmailService } from './promo-email.service';
import { PrismaService } from '../../shared/services';

@Module({
  imports: [ConfigModule],
  controllers: [PromoController],
  providers: [PromoService, PromoEmailService, PrismaService],
  exports: [PromoService],
})
export class PromoModule {}
