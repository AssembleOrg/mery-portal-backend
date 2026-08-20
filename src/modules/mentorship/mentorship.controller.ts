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
  RescheduleMentorshipDto,
  UpdateAvailabilityDto,
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

  // --------------------- Admin ---------------------

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
