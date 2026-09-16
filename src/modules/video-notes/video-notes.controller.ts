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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Roles } from '../../shared/decorators';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';
import { VideoNotesService } from './video-notes.service';
import { CreateVideoNoteDto, UpdateVideoNoteDto } from './dto';

@ApiTags('Video notes')
@Controller('video-notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class VideoNotesController {
  constructor(private readonly service: VideoNotesService) {}

  @Get('video/:videoId')
  @ApiOperation({ summary: 'Mis notas de un video' })
  listByVideo(@Param('videoId') videoId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listMineByVideo(user.sub, user.role as UserRole, videoId);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Mi diario de una formación (todas las notas)' })
  listByCategory(@Param('categoryId') categoryId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listMineByCategory(user.sub, user.role as UserRole, categoryId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nota en un segundo del video' })
  create(@Body() dto: CreateVideoNoteDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(user.sub, user.role as UserRole, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una nota propia' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVideoNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar una nota propia' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(user.sub, id);
  }

  // ─── Admin ────────────────────────────────────────────────────────

  @Get('admin/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Alumnas con notas: cantidad y última nota' })
  adminSummary() {
    return this.service.adminSummary();
  }

  @Get('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiOperation({ summary: 'Todas las notas de una alumna (opcional: de una formación)' })
  adminListByUser(@Param('userId') userId: string, @Query('categoryId') categoryId?: string) {
    return this.service.adminListByUser(userId, categoryId || undefined);
  }
}
