import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { VideosService } from './videos.service';
import { CreateVideoDto, UpdateVideoDto, VideoResponseDto, VideoQueryDto, UploadVideoDto, UploadStatusDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles, Auditory, CurrentUser, Public } from '../../shared/decorators';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @Auditory({ action: 'CREATE', entity: 'Video' })
  @ApiOperation({ summary: 'Crear nuevo video (Admin/Subadmin)' })
  @ApiResponseDoc({
    status: 201,
    description: 'Video creado exitosamente',
    type: VideoResponseDto,
  })
  async create(
    @Body() createVideoDto: CreateVideoDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VideoResponseDto> {
    return this.videosService.create(createVideoDto, user.role);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Obtener lista de videos' })
  @ApiResponseDoc({
    status: 200,
    description: 'Lista de videos obtenida exitosamente',
  })
  async findAll(
    @Query() query: VideoQueryDto,
    @Req() request: any,
  ) {
    // Get userId and role from JWT if authenticated, otherwise undefined
    const userId = request.user?.sub;
    const userRole = request.user?.role;
    return this.videosService.findAll(query, userId, userRole);
  }

  @Get(':identifier')
  @Public()
  @ApiOperation({ summary: 'Obtener video por ID o slug' })
  @ApiResponseDoc({
    status: 200,
    description: 'Video obtenido exitosamente',
    type: VideoResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Video no encontrado',
  })
  async findOne(
    @Param('identifier') identifier: string,
    @Req() request: any,
  ): Promise<VideoResponseDto> {
    const userId = request.user?.sub;
    const userRole = request.user?.role;
    return this.videosService.findOne(identifier, userId, userRole);
  }

  @Get(':id/stream')
  @Public()
  @ApiOperation({ summary: 'Obtener URL de streaming segura (Público para videos order=0)' })
  @ApiResponseDoc({
    status: 200,
    description: 'URL de streaming obtenida exitosamente',
  })
  @ApiResponseDoc({
    status: 403,
    description: 'No tienes acceso a este video',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Video no encontrado',
  })
  async getStreamingUrl(
    @Param('id') id: string,
    @Req() request: any,
  ) {
    // Usuario autenticado opcional (solo requerido para videos con order > 0)
    const userId = request.user?.sub;
    return this.videosService.getStreamingUrl(id, userId);
  }

  @Post(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar progreso de visualización' })
  @ApiResponseDoc({
    status: 200,
    description: 'Progreso actualizado exitosamente',
  })
  async updateProgress(
    @Param('id') id: string,
    @Body() body: { watchedSeconds: number; completed?: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    await this.videosService.updateProgress(
      user.sub,
      id,
      body.watchedSeconds,
      body.completed,
    );
    return { message: 'Progreso actualizado exitosamente' };
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener progreso de visualización' })
  @ApiResponseDoc({
    status: 200,
    description: 'Progreso obtenido exitosamente',
  })
  async getProgress(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.videosService.getProgress(user.sub, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @Auditory({ action: 'UPDATE', entity: 'Video' })
  @ApiOperation({ summary: 'Actualizar video (Admin/Subadmin)' })
  @ApiResponseDoc({
    status: 200,
    description: 'Video actualizado exitosamente',
    type: VideoResponseDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Video no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateVideoDto: UpdateVideoDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VideoResponseDto> {
    return this.videosService.update(id, updateVideoDto, user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auditory({ action: 'DELETE', entity: 'Video' })
  @ApiOperation({ summary: 'Eliminar video (Admin/Subadmin)' })
  @ApiResponseDoc({
    status: 204,
    description: 'Video eliminado exitosamente',
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Video no encontrado',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.videosService.remove(id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @Auditory({ action: 'UPLOAD', entity: 'Video' })
  @ApiOperation({ 
    summary: 'Subir video a Vimeo (Admin/Subadmin)',
    description: 'Sube un archivo de video grande (hasta 2GB) a Vimeo usando el protocolo tus para carga resumible.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Video file and metadata',
    schema: {
      type: 'object',
      required: ['file', 'title', 'slug', 'categoryId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Video file (max 2GB)',
        },
        title: {
          type: 'string',
          example: 'Técnica Avanzada de Microblading',
          description: 'Título del video',
        },
        slug: {
          type: 'string',
          example: 'tecnica-avanzada-microblading',
          description: 'Slug único para el video',
        },
        description: {
          type: 'string',
          example: 'En este video aprenderás...',
          description: 'Descripción del video',
        },
        categoryId: {
          type: 'string',
          example: 'clx123...',
          description: 'ID de la categoría/curso',
        },
        order: {
          type: 'number',
          example: 1,
          description: 'Orden del video (0 = preview gratis)',
        },
        isPublished: {
          type: 'boolean',
          example: false,
          description: 'Publicar inmediatamente',
        },
      },
    },
  })
  @ApiResponseDoc({
    status: 201,
    description: 'Video subido y creado exitosamente',
    type: VideoResponseDto,
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Archivo inválido o datos incorrectos',
  })
  @ApiResponseDoc({
    status: 409,
    description: 'Slug duplicado o error de Vimeo',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './tmp/uploads';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `video-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
      },
      fileFilter: (req, file, cb) => {
        // Validate file type
        const allowedMimeTypes = [
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-matroska',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Tipo de archivo no permitido. Formatos aceptados: MP4, MPEG, MOV, AVI, MKV`,
            ),
            false,
          );
        }

        // Validate extension
        const allowedExtensions = ['.mp4', '.mpeg', '.mov', '.avi', '.mkv'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (!allowedExtensions.includes(ext)) {
          return cb(
            new BadRequestException(
              `Extensión de archivo no permitida. Extensiones aceptadas: ${allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadVideoDto: UploadVideoDto,
  ): Promise<VideoResponseDto> {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo de video');
    }

    try {
      const video = await this.videosService.uploadVideo(file, uploadVideoDto);
      return video;
    } catch (error) {
      // Clean up temporary file on error
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Get(':id/upload-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Verificar estado de procesamiento en Vimeo (Admin/Subadmin)',
    description: 'Verifica si el video terminó de procesarse en Vimeo y está listo para visualización.',
  })
  @ApiResponseDoc({
    status: 200,
    description: 'Estado del video obtenido exitosamente',
    type: UploadStatusDto,
  })
  @ApiResponseDoc({
    status: 404,
    description: 'Video no encontrado',
  })
  async getUploadStatus(@Param('id') id: string) {
    return this.videosService.getUploadStatus(id);
  }
}
