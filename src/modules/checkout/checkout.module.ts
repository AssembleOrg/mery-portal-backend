import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../shared/services';
import { CouponsModule } from '../coupons';

@Module({
  imports: [CouponsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
