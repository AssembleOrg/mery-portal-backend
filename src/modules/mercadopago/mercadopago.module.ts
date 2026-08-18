import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MercadoPagoController, WebhookAliasController } from './mercadopago.controller';
import { MercadoPagoService } from './mercadopago.service';
import { PrismaService } from '../../shared/services';
import { CartModule } from '../cart/cart.module';
import { ChatModule } from '../chat/chat.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [ConfigModule, CartModule, ChatModule, RewardsModule],
  controllers: [MercadoPagoController, WebhookAliasController],
  providers: [MercadoPagoService, PrismaService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}

