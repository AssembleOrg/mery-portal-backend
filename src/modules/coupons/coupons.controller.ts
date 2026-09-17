import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '~/shared/types';
import { CouponsService } from './coupons.service';
import { ConfirmConsumptionDto, CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles, CurrentUser } from '~/shared/decorators';
import type { JwtPayload } from '~/shared/types';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async findAll() {
    return this.couponsService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }

  // Public for authenticated users (not admin-only)
  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.couponsService.validateCoupon(dto, user?.sub);
  }

  @Post(':id/consume')
  async consume(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.consume(id, user.sub);
  }

  // Libera solo una reserva pendiente del propio usuario (no toca usos confirmados).
  @Post(':id/release')
  async release(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.release(id, user.sub);
  }

  // Reserva un uso para la preference recién creada. La confirmación del uso
  // la hace el webhook de Mercado Pago en el backend al aprobarse el pago.
  @Post('confirm-consumption')
  async confirmConsumption(
    @Body() dto: ConfirmConsumptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.couponsService.confirmConsumption(
      dto.couponId,
      user.sub,
      dto.preferenceId,
    );
  }
}
