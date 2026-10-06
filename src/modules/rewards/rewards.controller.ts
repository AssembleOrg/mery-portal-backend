import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards';
import { CurrentUser } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@ApiBearerAuth()
@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  /** Cupón 20% OFF nueva formación (3 meses), reclamado desde el form de mentoría. */
  @Post('new-course-coupon')
  claimNewCourseCoupon(@CurrentUser() user: JwtPayload) {
    return this.rewards.claimNewCourseCoupon(user.sub);
  }
}
