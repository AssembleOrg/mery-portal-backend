import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { SettingsModule } from '../settings';
import { PromoCloseService } from './promo-close.service';

@Module({
  imports: [SettingsModule],
  providers: [PromoCloseService, PrismaService],
})
export class PromoModule {}
