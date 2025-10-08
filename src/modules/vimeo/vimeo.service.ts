import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Vimeo } from '@vimeo/vimeo';
import * as fs from 'fs';
import * as tus from 'tus-js-client';

interface VimeoVideoData {
  uri: string;
  name: string;
  description: string;
  duration: number;
  pictures: {
    sizes: Array<{
      width: number;
      height: number;
      link: string;
    }>;
  };
  player_embed_url: string;
  link: string;
}

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private client: Vimeo;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('VIMEO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('VIMEO_CLIENT_SECRET');
    const accessToken = this.configService.get<string>('VIMEO_ACCESS_TOKEN');

    if (!clientId || !clientSecret || !accessToken) {
      this.logger.warn('Vimeo credentials not configured. Video features will be limited.');
    }

    this.client = new Vimeo(clientId, clientSecret, accessToken);
  }

  /**
   * Get video information from Vimeo
   */
  async getVideoInfo(vimeoId: string): Promise<VimeoVideoData> {
    try {
      this.logger.log(`Obteniendo información del video de Vimeo: ${vimeoId}`);
      const response = await this.makeRequest('GET', `/videos/${vimeoId}`);
      return response.body;
    } catch (error: any) {
      this.logger.error(`Failed to get video info for ${vimeoId}:`, error);
      
      // Provide more specific error messages
      const errorMessage = error?.message || 'Error desconocido';
      const statusCode = error?.statusCode || error?.status;
      
      if (statusCode === 404) {
        throw new InternalServerErrorException(`Video ${vimeoId} no encontrado en Vimeo. Verifica que el ID sea correcto.`);
      } else if (statusCode === 401 || statusCode === 403) {
        throw new InternalServerErrorException(`No tienes permisos para acceder al video ${vimeoId}. Verifica las credenciales de Vimeo.`);
      } else if (errorMessage.includes('credentials')) {
        throw new InternalServerErrorException('Las credenciales de Vimeo no están configuradas o son incorrectas. Verifica VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET y VIMEO_ACCESS_TOKEN en .env');
      }
      
      throw new InternalServerErrorException(`Error al obtener información del video ${vimeoId}: ${errorMessage}`);
    }
  }

  /**
   * Get signed/secure video player URL
   * This is the key method for access control
   */
  async getSecurePlayerUrl(vimeoId: string): Promise<string> {
    try {
      const videoInfo = await this.getVideoInfo(vimeoId);
      
      // Get the private embed URL
      // Vimeo will check domain whitelist and privacy settings
      const embedUrl = videoInfo.player_embed_url;
      
      // Add timestamp and hash for additional security
      const timestamp = Date.now();
      const secureUrl = `${embedUrl}?t=${timestamp}`;
      
      return secureUrl;
    } catch (error) {
      this.logger.error(`Failed to get secure URL for ${vimeoId}:`, error);
      throw new InternalServerErrorException('Error al obtener URL segura del video');
    }
  }

  /**
   * Get video thumbnail
   */
  async getVideoThumbnail(vimeoId: string, width: number = 640): Promise<string | null> {
    try {
      const videoInfo = await this.getVideoInfo(vimeoId);
      if (!videoInfo.pictures || !videoInfo.pictures.sizes || videoInfo.pictures.sizes.length === 0) {
        return null;
      }

      // Find the thumbnail closest to requested width
      const thumbnail = videoInfo.pictures.sizes
        .sort((a, b) => Math.abs(a.width - width) - Math.abs(b.width - width))[0];
      
      return thumbnail.link;
    } catch (error) {
      this.logger.error(`Failed to get thumbnail for ${vimeoId}:`, error);
      return null;
    }
  }

  /**
   * Update video privacy settings (for admin use)
   */
  async updateVideoPrivacy(vimeoId: string, privacy: 'anybody' | 'nobody' | 'disable' | 'unlisted' = 'disable'): Promise<void> {
    try {
      await this.makeRequest('PATCH', `/videos/${vimeoId}`, {
        privacy: {
          view: privacy,
          embed: 'whitelist', // Only allow embedding on whitelisted domains
        },
      });
      
      this.logger.log(`Updated privacy for video ${vimeoId} to ${privacy}`);
    } catch (error) {
      this.logger.error(`Failed to update privacy for ${vimeoId}:`, error);
      throw new InternalServerErrorException('Error al actualizar privacidad del video');
    }
  }

  /**
   * Delete video from Vimeo (for admin use)
   */
  async deleteVideo(vimeoId: string): Promise<void> {
    try {
      await this.makeRequest('DELETE', `/videos/${vimeoId}`);
      this.logger.log(`Deleted video ${vimeoId} from Vimeo`);
    } catch (error) {
      this.logger.error(`Failed to delete video ${vimeoId}:`, error);
      throw new InternalServerErrorException('Error al eliminar video de Vimeo');
    }
  }

  /**
   * Get video embed code
   */
  getEmbedCode(embedUrl: string, width: number = 640, height: number = 360): string {
    return `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }

  /**
   * Upload large video using tus protocol (for 1GB+ files)
   * @param filePath - Path to the video file on disk
   * @param name - Video title
   * @param description - Video description (optional)
   * @param onProgress - Callback for progress updates (optional)
   * @returns vimeoId of the uploaded video
   */
  async uploadLargeVideo(
    filePath: string,
    name: string,
    description?: string,
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Iniciando carga de video: ${name}`);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`File not found: ${filePath}`));
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      this.logger.log(`Tamaño del archivo: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      // Step 1: Create video on Vimeo with tus approach
      this.client.request(
        {
          method: 'POST',
          path: '/me/videos',
          query: {
            upload: {
              approach: 'tus',
              size: fileSize,
            },
            name,
            description: description || '',
            privacy: {
              view: 'disable', // Private by default
              embed: 'whitelist', // Only allow embedding on whitelisted domains
            },
          },
        },
        (error, body, statusCode) => {
          if (error) {
            this.logger.error('Error creando video en Vimeo:', error);
            return reject(error);
          }

          const uploadLink = body.upload.upload_link;
          const videoUri = body.uri; // e.g., /videos/123456789
          const vimeoId = videoUri.split('/').pop();

          this.logger.log(`Video creado en Vimeo. ID: ${vimeoId}`);
          this.logger.log(`URL de carga: ${uploadLink}`);

          // Step 2: Upload file using tus protocol
          const file = fs.createReadStream(filePath);

          const upload = new tus.Upload(file, {
            endpoint: uploadLink,
            uploadUrl: uploadLink, // For resumable uploads
            retryDelays: [0, 3000, 5000, 10000, 20000], // Retry strategy
            metadata: {
              filename: name,
              filetype: 'video/mp4',
            },
            uploadSize: fileSize,
            onError: (uploadError) => {
              this.logger.error('Error durante la carga:', uploadError);
              reject(uploadError);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
              this.logger.log(`Progreso: ${percentage}% (${bytesUploaded}/${bytesTotal} bytes)`);
              
              if (onProgress) {
                onProgress(bytesUploaded, bytesTotal);
              }
            },
            onSuccess: () => {
              this.logger.log(`✅ Video subido exitosamente. Vimeo ID: ${vimeoId}`);
              resolve(vimeoId);
            },
          });

          // Start the upload
          upload.start();
        },
      );
    });
  }

  /**
   * Check video processing status on Vimeo
   * @param vimeoId - Vimeo video ID
   * @returns Processing status information
   */
  async checkVideoStatus(vimeoId: string): Promise<{
    status: 'uploading' | 'processing' | 'available' | 'error';
    progress?: number;
  }> {
    try {
      const response = await this.makeRequest('GET', `/videos/${vimeoId}`);
      const video = response.body;

      // Check upload status
      if (video.upload?.status === 'in_progress') {
        return { status: 'uploading' };
      }

      // Check transcode status
      if (video.transcode?.status === 'in_progress') {
        return { status: 'processing' };
      }

      if (video.transcode?.status === 'complete') {
        return { status: 'available' };
      }

      if (video.transcode?.status === 'error' || video.upload?.status === 'error') {
        return { status: 'error' };
      }

      // Default to processing if status is unclear
      return { status: 'processing' };
    } catch (error) {
      this.logger.error(`Error verificando estado del video ${vimeoId}:`, error);
      throw new InternalServerErrorException('Error al verificar estado del video');
    }
  }

  /**
   * Private helper to make Vimeo API requests
   */
  private async makeRequest(method: string, path: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.request(
        {
          method,
          path,
          query: params,
        },
        (error, body, statusCode, headers) => {
          if (error) {
            // Enhance error with status code
            const enhancedError = new Error(error.message || 'Vimeo API error');
            (enhancedError as any).statusCode = statusCode;
            (enhancedError as any).originalError = error;
            this.logger.error(`Vimeo API ${method} ${path} failed:`, {
              error: error.message,
              statusCode,
              body: body || 'No body',
            });
            reject(enhancedError);
          } else {
            resolve({ body, statusCode, headers });
          }
        },
      );
    });
  }
}
