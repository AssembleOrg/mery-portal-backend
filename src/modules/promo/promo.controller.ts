import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles } from '~/shared/decorators';
import { UserRole } from '~/shared/types';
import { PromoService } from './promo.service';
import { CreatePromoCampaignDto, UpdatePromoCampaignDto } from './dto';

@ApiTags('promo-campaigns')
@ApiBearerAuth()
@Controller('promo-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  @Post()
  create(@Body() dto: CreatePromoCampaignDto) {
    return this.promo.create(dto);
  }

  @Get()
  findAll() {
    return this.promo.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promo.findOne(id);
  }

  @Get(':id/eligible')
  eligible(@Param('id') id: string) {
    return this.promo.previewEligible(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoCampaignDto) {
    return this.promo.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promo.remove(id);
  }

  @Post(':id/issue-rewards')
  issueRewards(@Param('id') id: string, @Query('force') force?: string) {
    return this.promo.issueRewards(id, force === 'true' || force === '1');
  }
}
