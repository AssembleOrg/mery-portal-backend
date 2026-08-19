import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../shared/services';
import { CouponsModule } from '../coupons';
import { SettingsModule } from '../settings';

@Module({
  imports: [CouponsModule, SettingsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
