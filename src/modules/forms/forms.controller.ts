import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormsService } from './forms.service';
import {
  CreateFormDto,
  UpdateFormDto,
  FormQueryDto,
  FormResponsesQueryDto,
  SubmitFormResponseDto,
  UpdateResponseStatusDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '~/shared/guards';
import { Roles } from '~/shared/decorators';
import { UserRole } from '~/shared/types';

@ApiTags('Formularios')
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  // ============ Public endpoints (no guard) ============

  @Get('public/:slug')
  @ApiOperation({ summary: 'Obtener formulario público por slug' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, description: 'Formulario público' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async getPublic(@Param('slug') slug: string) {
    return this.formsService.getPublicBySlug(slug);
  }

  @Post('public/:slug/responses')
  @HttpCode(201)
  @ApiOperation({ summary: 'Enviar respuesta a un formulario público' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 201, description: 'Respuesta registrada' })
  @ApiResponse({ status: 400, description: 'Respuestas inválidas o formulario cerrado' })
  async submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitFormResponseDto,
    @Req() request: any,
  ) {
    const ip = request.ip || request.headers['x-forwarded-for'];
    const userAgent = request.headers['user-agent'];
    return this.formsService.submit(slug, dto, ip, userAgent);
  }

  // ============ Admin endpoints ============

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear formulario (Admin/SubAdmin)' })
  async create(@Body() dto: CreateFormDto) {
    return this.formsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar formularios (Admin/SubAdmin)' })
  async findAll(@Query() query: FormQueryDto) {
    return this.formsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener formulario por ID (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar formulario (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Eliminar formulario (soft delete, Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Duplicar formulario (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async duplicate(@Param('id') id: string) {
    return this.formsService.duplicate(id);
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar respuestas de un formulario (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async getResponses(@Param('id') id: string, @Query() query: FormResponsesQueryDto) {
    return this.formsService.getResponses(id, query);
  }

  @Patch(':id/responses/:responseId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Cambiar estado de una respuesta (aceptar/rechazar). Al aceptar envía email de invitación (Admin/SubAdmin)',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'responseId' })
  async updateResponseStatus(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body() dto: UpdateResponseStatusDto,
  ) {
    return this.formsService.updateResponseStatus(id, responseId, dto);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Analítica de un formulario (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async getAnalytics(@Param('id') id: string) {
    return this.formsService.getAnalytics(id);
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Exportar respuestas como CSV (Admin/SubAdmin)' })
  @ApiParam({ name: 'id' })
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const { filename, content } = await this.formsService.exportCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
