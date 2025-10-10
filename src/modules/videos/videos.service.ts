import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { VimeoService } from '../vimeo/vimeo.service';
import { PaginatedResponse } from '../../shared/types';
import { CreateVideoDto, UpdateVideoDto, VideoResponseDto, VideoQueryDto, UploadVideoDto, UploadStatusDto } from './dto';
import { plainToClass } from 'class-transformer';
import * as fs from 'fs';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private prisma: PrismaService,
    private vimeoService: VimeoService,
  ) {}

  async create(createVideoDto: CreateVideoDto, userRole?: string): Promise<VideoResponseDto> {
    const { vimeoId, categoryId, ...videoData } = createVideoDto;

    // Check if vimeoId already exists
    // const existingVimeo = await this.prisma.video.findUnique({
    //   where: { vimeoId },
    // });

    // if (existingVimeo) {
    //   throw new ConflictException('Este video de Vimeo ya está registrado');
    // }

    // Verify category exists
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Get video info from Vimeo
    try {
      this.logger.log(`Obteniendo información del video de Vimeo: ${vimeoId}`);
      const vimeoInfo = await this.vimeoService.getVideoInfo(vimeoId);
      const thumbnail = await this.vimeoService.getVideoThumbnail(vimeoId);
      
        // Build clean data object (avoid undefined fields)
        const videoCreateData: any = {
          title: videoData.title,
          vimeoId,
          vimeoUrl: vimeoInfo.link,
          thumbnail,
          duration: vimeoInfo.duration,
          categoryId,
          order: videoData.order ?? 0,
          isPublished: videoData.isPublished ?? false,
        };

      // Only add optional fields if they are defined
      if (videoData.description) {
        videoCreateData.description = videoData.description;
      }
      if (videoData.metaTitle) {
        videoCreateData.metaTitle = videoData.metaTitle;
      }
      if (videoData.metaDescription) {
        videoCreateData.metaDescription = videoData.metaDescription;
      }
      if (videoData.isPublished) {
        videoCreateData.publishedAt = new Date();
      }

      // Create video
      const video = await this.prisma.video.create({
        data: videoCreateData,
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        this.logger.log(`Video creado exitosamente: ${video.id}`);
        return this.toVideoResponseDto(video, userRole);
      } catch (error: any) {
        this.logger.error('Error al crear video:', error);
        
        // If it's already a NestJS exception, just re-throw it
        if (error.status) {
          throw error;
        }
        
        // Handle Prisma errors
        if (error.code === 'P2002') {
          throw new ConflictException('Ya existe un video con ese vimeoId');
        }
      
      // Generic error
      const errorMessage = error.message || 'Error desconocido al crear el video';
      throw new ConflictException(`Error al crear video: ${errorMessage}`);
    }
  }

  async findAll(query: VideoQueryDto, userId?: string, userRole?: string): Promise<PaginatedResponse<VideoResponseDto>> {
    const { page = 1, limit = 10, search, sortBy = 'order', sortOrder = 'asc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as any } },
          { description: { contains: search, mode: 'insensitive' as any } },
        ],
      }),
      ...filters,
    };

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder as any },
        include: {
          category: {
              select: {
                id: true,
                name: true,
              },
          },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    // If userId provided, check access for each video
    const videosWithAccess = await Promise.all(
      videos.map(async (video) => {
        const videoDto: any = this.toVideoResponseDto(video, userRole);
        
        // No need to set hasAccess at video level anymore
        // Access is controlled at category/course level
        
        return videoDto;
      }),
    );

    return {
      data: videosWithAccess,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(identifier: string, userId?: string, userRole?: string): Promise<VideoResponseDto> {
    // Find by ID only
    const video = await this.prisma.video.findFirst({
      where: {
        id: identifier,
        deletedAt: null,
      },
      include: {
        category: {
              select: {
                id: true,
                name: true,
              },
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    const videoDto: any = this.toVideoResponseDto(video, userRole);

    // No need to check access at video level
    // Access is controlled at category/course level

    return videoDto;
  }

  async update(id: string, updateVideoDto: UpdateVideoDto, userRole?: string): Promise<VideoResponseDto> {
    const video = await this.prisma.video.findUnique({
      where: { id, deletedAt: null },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    // If vimeoId is being updated, get new info
    let vimeoUpdate = {};
    if (updateVideoDto.vimeoId && updateVideoDto.vimeoId !== video.vimeoId) {
      try {
        const vimeoInfo = await this.vimeoService.getVideoInfo(updateVideoDto.vimeoId);
        const thumbnail = await this.vimeoService.getVideoThumbnail(updateVideoDto.vimeoId);
        
        vimeoUpdate = {
          vimeoUrl: vimeoInfo.link,
          thumbnail,
          duration: vimeoInfo.duration,
        };
      } catch (error) {
        throw new ConflictException('Error al obtener información del video de Vimeo');
      }
    }

    const updatedVideo = await this.prisma.video.update({
      where: { id },
      data: {
        ...updateVideoDto,
        ...vimeoUpdate,
      },
      include: {
        category: {
              select: {
                id: true,
                name: true,
              },
        },
      },
    });

    return this.toVideoResponseDto(updatedVideo, userRole);
  }

  async remove(id: string): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id, deletedAt: null },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    // Soft delete
    await this.prisma.video.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get secure streaming URL for a video
   * This is the KEY method for access control
   * 
   * Videos with order = 0 are public (preview/free videos)
   * Videos with order > 0 require authentication and purchase
   * ADMIN and SUBADMIN have unrestricted access to all videos
   */
  async getStreamingUrl(videoId: string, userId?: string, userRole?: string): Promise<{ streamUrl: string; expiresIn: number }> {
    // Find video
    const video = await this.prisma.video.findUnique({
      where: { id: videoId, deletedAt: null },
      select: {
        id: true,
        vimeoId: true,
        isPublished: true,
        order: true,
        categoryId: true,
      },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    // Check if user is admin or subadmin (they have unrestricted access)
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUBADMIN';

    // Admins can view unpublished videos, regular users cannot
    if (!video.isPublished && !isAdmin) {
      throw new ForbiddenException('Este video no está disponible');
    }

    // Videos with order = 0 are public (preview/free videos)
    const isPreviewVideo = video.order === 0;

    // Admins and Subadmins have unrestricted access
    if (!isAdmin && !isPreviewVideo) {
      // For non-preview videos, require authentication
      if (!userId) {
        throw new ForbiddenException('Debes iniciar sesión para acceder a este video');
      }

      // Check if user has access to the category/course
      const hasAccess = await this.checkUserAccess(userId, video.categoryId);
      
      if (!hasAccess) {
        throw new ForbiddenException('Debes comprar este curso para acceder al contenido');
      }
    }

    // Get secure URL from Vimeo
    const streamUrl = await this.vimeoService.getSecurePlayerUrl(video.vimeoId);

    // Record view (only if user is authenticated)
    if (userId) {
      await this.recordView(userId, videoId);
    }

    return {
      streamUrl,
      expiresIn: 3600, // URL valid for 1 hour
    };
  }

  /**
   * Check if user has access to a category/course
   */
  private async checkUserAccess(userId: string, categoryId: string): Promise<boolean> {
    // Check if category/course is free
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
      select: { isFree: true },
    });

    if (category?.isFree) {
      return true;
    }

    // Check if user purchased the category/course
    const purchase = await this.prisma.categoryPurchase.findUnique({
      where: {
        userId_categoryId: { userId, categoryId },
      },
    });

    if (!purchase) {
      return false;
    }

    // Check if purchase is active
    if (!purchase.isActive) {
      return false;
    }

    // Check if purchase has expired
    if (purchase.expiresAt && purchase.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Record or update video view
   */
  private async recordView(userId: string, videoId: string): Promise<void> {
    await this.prisma.videoView.upsert({
      where: {
        userId_videoId: { userId, videoId },
      },
      update: {
        lastWatchedAt: new Date(),
      },
      create: {
        userId,
        videoId,
        lastWatchedAt: new Date(),
      },
    });
  }

  /**
   * Update video view progress
   */
  async updateProgress(
    userId: string,
    videoId: string,
    watchedSeconds: number,
    completed: boolean = false,
  ): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { duration: true },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    const progress = video.duration ? Math.min(100, Math.round((watchedSeconds / video.duration) * 100)) : 0;

    await this.prisma.videoView.update({
      where: {
        userId_videoId: { userId, videoId },
      },
      data: {
        watchedSeconds,
        totalSeconds: video.duration,
        progress,
        completed,
        lastWatchedAt: new Date(),
      },
    });
  }

  /**
   * Get user's video progress
   */
  async getProgress(userId: string, videoId: string) {
    const view = await this.prisma.videoView.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (!view) {
      return {
        watchedSeconds: 0,
        progress: 0,
        completed: false,
      };
    }

    return {
      watchedSeconds: view.watchedSeconds,
      progress: view.progress,
      completed: view.completed,
      lastWatchedAt: view.lastWatchedAt,
    };
  }

  /**
   * Upload video file to Vimeo and create database record
   * This method handles large files (up to 2GB) using tus protocol
   */
  async uploadVideo(
    file: Express.Multer.File,
    uploadVideoDto: UploadVideoDto,
  ): Promise<VideoResponseDto> {
    const { categoryId, title, description, order, isPublished } = uploadVideoDto;

    // Verify category exists
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    try {
      this.logger.log(`Iniciando carga de video a Vimeo: ${title}`);
      this.logger.log(`Archivo: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Upload to Vimeo using tus protocol
      const vimeoId = await this.vimeoService.uploadLargeVideo(
        file.path,
        title,
        description,
        (bytesUploaded, bytesTotal) => {
          const progress = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          this.logger.log(`Progreso de carga: ${progress}%`);
        },
      );

      this.logger.log(`Video subido a Vimeo exitosamente. ID: ${vimeoId}`);

      // Wait a moment for Vimeo to start processing
      await this.waitForVideoAvailability(vimeoId);

      // Get video info from Vimeo
      const vimeoInfo = await this.vimeoService.getVideoInfo(vimeoId);
      const thumbnail = await this.vimeoService.getVideoThumbnail(vimeoId);

      // Create video record in database
      const video = await this.prisma.video.create({
        data: {
          title,
          description,
          vimeoId,
          vimeoUrl: vimeoInfo.link,
          thumbnail,
          duration: vimeoInfo.duration,
          categoryId,
          order: order || 0,
          isPublished: isPublished || false,
          publishedAt: isPublished ? new Date() : null,
        },
        include: {
          category: {
              select: {
                id: true,
                name: true,
              },
          },
        },
      });

      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        this.logger.log(`Archivo temporal eliminado: ${file.path}`);
      }

      this.logger.log(`✅ Video creado en base de datos. ID: ${video.id}`);

      return this.toVideoResponseDto(video, 'ADMIN'); // Upload is always done by admin
    } catch (error) {
      // Clean up temporary file on error
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        this.logger.log(`Archivo temporal eliminado después de error: ${file.path}`);
      }

      this.logger.error('Error durante la carga del video:', error);
      
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al subir el video. Por favor intenta de nuevo.',
      );
    }
  }

  /**
   * Get upload/processing status from Vimeo
   */
  async getUploadStatus(videoId: string): Promise<UploadStatusDto> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId, deletedAt: null },
      select: { vimeoId: true },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }

    const status = await this.vimeoService.checkVideoStatus(video.vimeoId);

    const statusMessages = {
      uploading: 'El video se está cargando a Vimeo...',
      processing: 'El video está siendo procesado por Vimeo. Esto puede tomar varios minutos.',
      available: 'El video está listo y disponible para visualización.',
      error: 'Hubo un error al procesar el video en Vimeo.',
    };

    return plainToClass(
      UploadStatusDto,
      {
        status: status.status,
        progress: status.progress,
        message: statusMessages[status.status],
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Wait for video to be available on Vimeo (with timeout)
   */
  private async waitForVideoAvailability(vimeoId: string): Promise<void> {
    const maxAttempts = 30; // 5 minutes max (30 * 10 seconds)
    let attempts = 0;

    this.logger.log('Esperando a que Vimeo procese el video...');

    while (attempts < maxAttempts) {
      try {
        const status = await this.vimeoService.checkVideoStatus(vimeoId);

        if (status.status === 'available') {
          this.logger.log('✅ Video disponible en Vimeo');
          return;
        }

        if (status.status === 'error') {
          throw new InternalServerErrorException('Error procesando el video en Vimeo');
        }

        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;

        this.logger.log(`Verificando estado del video... (${attempts}/${maxAttempts})`);
      } catch (error) {
        // If we can't get the status, continue anyway
        this.logger.warn('Error verificando estado, continuando...');
        return;
      }
    }

    // Timeout reached, but we'll create the video anyway
    // The admin can check status later with /upload-status endpoint
    this.logger.warn('Timeout esperando procesamiento de Vimeo, continuando de todas formas...');
  }

  /**
   * Convert video entity to DTO with proper serialization based on user role
   */
  private toVideoResponseDto(video: any, userRole?: string): VideoResponseDto {
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUBADMIN';
    
    return plainToClass(VideoResponseDto, video, {
      excludeExtraneousValues: true,
      groups: isAdmin ? ['admin'] : [],
    });
  }
}
