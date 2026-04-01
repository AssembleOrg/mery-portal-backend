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
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles, CurrentUser, Public } from '~/shared/decorators';
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
  async validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validateCoupon(dto);
  }

  @Post(':id/consume')
  async consume(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.consume(id, user.sub);
  }

  @Post(':id/release')
  async release(@Param('id') id: string) {
    return this.couponsService.release(id);
  }

  @Post('confirm-consumption')
  @Public()
  async confirmConsumption(@Body() body: { couponId: string; userId: string }) {
    return this.couponsService.confirmConsumption(body.couponId, body.userId);
  }
}
