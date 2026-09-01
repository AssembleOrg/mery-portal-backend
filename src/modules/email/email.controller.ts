import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../shared/decorators';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { UserRole } from '../../shared/types';
import { SendCampaignDto } from './dto';
import { EmailService } from './email.service';

@ApiTags('email')
@ApiBearerAuth('JWT-auth')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('campaigns/formaciones/send')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({
    summary: 'Previsualizar o enviar la campaña de Formaciones a clientes',
  })
  @ApiResponse({
    status: 200,
    description: 'Vista previa o resultado del envío',
  })
  async sendFormacionesCampaign(
    @Body() dto: SendCampaignDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.emailService.sendFormacionesCampaignToClients({
      limit: dto.limit,
      confirm: dto.confirm,
      requestedBy: user.sub,
    });
  }
}
