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
import { CurrentUser, Roles } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { MentorshipService } from './mentorship.service';
import {
  BookMentorshipDto,
  CreateAvailabilityDto,
  CreateProductDto,
  CreateVariantDto,
  GrantCreditDto,
  RescheduleMentorshipDto,
  UpdateAvailabilityDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto';

@ApiTags('mentorship')
@ApiBearerAuth()
@Controller('mentorship')
@UseGuards(JwtAuthGuard)
export class MentorshipController {
  constructor(private readonly mentorship: MentorshipService) {}

  // --------------------- Alumno ---------------------

  @Get('slots')
  slots() {
    return this.mentorship.availableSlots();
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.mentorship.listMine(user.sub);
  }

  @Get('eligibility/:categoryId')
  eligibility(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId') categoryId: string,
  ) {
    return this.mentorship.getEligibility(user.sub, categoryId);
  }

  @Post('book')
  book(@CurrentUser() user: JwtPayload, @Body() dto: BookMentorshipDto) {
    return this.mentorship.book(user.sub, dto);
  }

  @Post(':id/reschedule')
  reschedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RescheduleMentorshipDto,
  ) {
    return this.mentorship.reschedule(user.sub, id, dto.start);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.mentorship.cancel(user.sub, id);
  }

  // Catálogo público de productos pagos (mentorías / one-to-one) con variantes.
  @Get('products')
  products() {
    return this.mentorship.listProductsPublic();
  }

  // Créditos pagos disponibles del alumno logueado.
  @Get('my-credits')
  myCredits(@CurrentUser() user: JwtPayload) {
    return this.mentorship.listMyCredits(user.sub);
  }

  // --------------------- Admin ---------------------

  // ----- Productos + variantes (catálogo editable) -----

  @Get('admin/products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  adminProducts() {
    return this.mentorship.listProductsAdmin();
  }

  @Post('admin/products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createProduct(@Body() dto: CreateProductDto) {
    return this.mentorship.createProduct(dto);
  }

  @Patch('admin/products/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.mentorship.updateProduct(id, dto);
  }

  @Delete('admin/products/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeProduct(@Param('id') id: string) {
    return this.mentorship.removeProduct(id);
  }

  @Post('admin/products/:id/variants')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.mentorship.addVariant(id, dto);
  }

  @Patch('admin/variants/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateVariant(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    return this.mentorship.updateVariant(id, dto);
  }

  @Delete('admin/variants/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeVariant(@Param('id') id: string) {
    return this.mentorship.removeVariant(id);
  }

  // ----- Créditos pagos (validación manual del pago) -----

  @Get('admin/credits')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listCredits(@Query('userId') userId: string) {
    return this.mentorship.listCredits(userId);
  }

  @Post('admin/credits')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  grantCredit(@CurrentUser() user: JwtPayload, @Body() dto: GrantCreditDto) {
    return this.mentorship.grantCredit(dto, user.sub);
  }

  @Delete('admin/credits/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  revokeCredit(@Param('id') id: string) {
    return this.mentorship.revokeCredit(id);
  }

  @Get('admin/calendar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  calendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.mentorship.listAdmin({ from, to, status });
  }

  @Get('admin/slots')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  adminSlots() {
    // Admin ve todas las franjas futuras (sin el cutoff de 3 días).
    return this.mentorship.availableSlots(false);
  }

  @Post('admin/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  adminCancel(@Param('id') id: string) {
    return this.mentorship.adminCancel(id);
  }

  @Post('admin/:id/reschedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  adminReschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleMentorshipDto,
  ) {
    return this.mentorship.adminReschedule(id, dto.start);
  }

  @Get('admin/availability')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listAvailability() {
    return this.mentorship.listAvailability();
  }

  @Post('admin/availability')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.mentorship.createAvailability(dto);
  }

  @Patch('admin/availability/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.mentorship.updateAvailability(id, dto);
  }

  @Delete('admin/availability/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeAvailability(@Param('id') id: string) {
    return this.mentorship.removeAvailability(id);
  }
}
