import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards';
import { CurrentUser } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { CheckoutService } from './checkout.service';
import { QuoteDto } from './dto/quote.dto';

@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /**
   * Devuelve los line-items con precios AUTORITATIVOS (calculados en el backend
   * desde la DB), el cupón validado y el plan de cuotas efectivo. El creador de
   * la preference de MP debe usar estos precios y no los que mande el cliente.
   */
  @Post('quote')
  async quote(@CurrentUser() user: JwtPayload, @Body() dto: QuoteDto) {
    return this.checkout.quote({
      userId: user.sub,
      categoryIds: dto.categoryIds,
      couponCode: dto.couponCode,
      installments: dto.installments,
    });
  }
}
