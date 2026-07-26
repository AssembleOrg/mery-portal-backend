import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Roles } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Listar configuraciones editables' })
  async list() {
    return this.settings.listAll();
  }

  @Put('admin/:key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar una configuración' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settings.set(key, dto.value, user.sub);
  }
}
