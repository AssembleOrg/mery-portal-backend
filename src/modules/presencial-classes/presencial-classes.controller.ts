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
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Auditory, CurrentUser, Roles } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { PresencialClassesService } from './presencial-classes.service';
import { PresencialDepositsService } from './presencial-deposits.service';
import { SettingsService } from '../settings/settings.service';
import {
  CreatePresencialClassDto,
  CreatePresencialPriceDto,
  SignupDto,
  StartDepositDto,
  UpdatePresencialClassDto,
  UpdatePresencialPriceDto,
} from './dto';

@ApiTags('presencial-classes')
@ApiBearerAuth()
@Controller('presencial-classes')
@UseGuards(JwtAuthGuard)
export class PresencialClassesController {
  constructor(
    private readonly service: PresencialClassesService,
    private readonly deposits: PresencialDepositsService,
    private readonly settings: SettingsService,
  ) {}

  // --------------------- Alumna ---------------------

  /** Próximas clases (sin cupos) con el estado de mi inscripción. */
  @Get('upcoming')
  upcoming(@CurrentUser() user: JwtPayload) {
    return this.service.listUpcoming(user.sub);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.service.mine(user.sub);
  }

  /**
   * Lo que hay que mostrar ANTES de mandar a pagar: monto de la seña y el
   * disclaimer que la alumna tiene que aceptar. Sin seña definida devuelve
   * deposit en null y la fecha no se puede reservar.
   */
  @Get(':id/deposit')
  async depositInfo(@Param('id') id: string) {
    const [quote, disclaimer] = await Promise.all([
      this.deposits.quoteForClass(id),
      this.settings.getPresencialDepositDisclaimer(),
    ]);
    return { deposit: quote, disclaimer };
  }

  /** Crea la preference de MP. Requiere haber aceptado el disclaimer. */
  @Post(':id/deposit')
  startDeposit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StartDepositDto,
  ) {
    return this.deposits.start({
      userId: user.sub,
      classId: id,
      acceptedDisclaimer: dto.acceptedDisclaimer,
    });
  }

  @Post(':id/signup')
  signup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SignupDto,
  ) {
    return this.service.signup(user.sub, id, dto.note);
  }

  @Post('signups/:id/cancel')
  cancelSignup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.cancelSignup(user.sub, id);
  }

  // --------------------- Admin ---------------------

  @Get('admin/calendar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  calendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listAdmin({ from, to, status });
  }

  // --------------------- Listado de precios (admin) ---------------------

  @Get('admin/prices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listPrices() {
    return this.deposits.listPrices();
  }

  @Post('admin/prices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createPrice(@Body() dto: CreatePresencialPriceDto) {
    return this.deposits.createPrice(dto);
  }

  @Patch('admin/prices/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updatePrice(@Param('id') id: string, @Body() dto: UpdatePresencialPriceDto) {
    return this.deposits.updatePrice(id, dto);
  }

  @Delete('admin/prices/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deletePrice(@Param('id') id: string) {
    return this.deposits.deletePrice(id);
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'CREATE', entity: 'PresencialClass' })
  create(@Body() dto: CreatePresencialClassDto) {
    return this.service.create(dto);
  }

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'UPDATE', entity: 'PresencialClass' })
  update(@Param('id') id: string, @Body() dto: UpdatePresencialClassDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Auditory({ action: 'DELETE', entity: 'PresencialClass' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('admin/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'CONFIRM', entity: 'PresencialClass' })
  confirmClass(@Param('id') id: string) {
    return this.service.confirmClass(id);
  }

  @Post('admin/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'CANCEL', entity: 'PresencialClass' })
  cancelClass(@Param('id') id: string) {
    return this.service.cancelClass(id);
  }

  @Post('admin/signups/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'CONFIRM', entity: 'PresencialSignup' })
  confirmSignup(@Param('id') id: string) {
    return this.service.confirmSignup(id);
  }

  @Post('admin/signups/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @Auditory({ action: 'REJECT', entity: 'PresencialSignup' })
  rejectSignup(@Param('id') id: string) {
    return this.service.rejectSignup(id);
  }
}
