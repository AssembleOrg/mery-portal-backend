import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string | null;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    const rawEndpoint = this.config.get<string>('DO_SPACES_ENDPOINT', '').trim();
    // Normalizamos: siempre con https://. Si viene "nyc3.digitaloceanspaces.com"
    // el SDK lo trata como región y arma el host de AWS por default.
    this.endpoint = rawEndpoint
      ? /^https?:\/\//i.test(rawEndpoint)
        ? rawEndpoint
        : `https://${rawEndpoint}`
      : '';
    const region = this.config.get<string>('DO_SPACES_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('DO_SPACES_KEY', '');
    const secretAccessKey = this.config.get<string>('DO_SPACES_SECRET', '');
    this.bucket = this.config.get<string>('DO_SPACES_BUCKET', '');
    this.cdnUrl = this.config.get<string>('DO_SPACES_CDN_URL') || null;

    if (!this.endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.warn(
        `DigitalOcean Spaces no está configurado correctamente. endpoint=${!!this.endpoint} key=${!!accessKeyId} secret=${!!secretAccessKey} bucket=${!!this.bucket}`,
      );
    } else {
      this.logger.log(
        `DigitalOcean Spaces configurado: endpoint=${this.endpoint} region=${region} bucket=${this.bucket} cdn=${
          this.cdnUrl ?? '(sin CDN)'
        }`,
      );
    }

    this.client = new S3Client({
      endpoint: this.endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      // Path-style: URLs del tipo https://endpoint/bucket/key. Evita que el SDK
      // reescriba el host con virtual-hosted-style (que termina resolviendo a AWS
      // en vez de DO cuando el endpoint no se interpreta correctamente).
      forcePathStyle: true,
      // DigitalOcean Spaces NO soporta los headers de checksum que el SDK de
      // AWS empezó a mandar por default desde v3.7xx (x-amz-checksum-crc32, etc.).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async uploadBuffer(params: {
    buffer: Buffer;
    contentType: string;
    originalName?: string;
    folder?: string;
  }): Promise<{ url: string; key: string }> {
    const { buffer, contentType, originalName, folder = 'uploads' } = params;
    const ext = originalName ? path.extname(originalName) : this.extFromMime(contentType);
    const safeFolder = folder.replace(/^\/+|\/+$/g, '');
    const key = `${safeFolder}/${Date.now()}-${randomUUID()}${ext}`;

    if (!this.bucket) {
      this.logger.error(
        'DO_SPACES_BUCKET no configurado. Revisá las variables de entorno.',
      );
      throw new InternalServerErrorException(
        'Storage no configurado (bucket ausente)',
      );
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: ObjectCannedACL.public_read,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      const e = err as Error & { name?: string; $metadata?: { httpStatusCode?: number }; Code?: string };
      this.logger.error(
        `Upload failed for key ${key} — name=${e.name ?? '?'} code=${
          e.Code ?? '?'
        } httpStatus=${e.$metadata?.httpStatusCode ?? '?'} msg=${e.message ?? '?'}`,
        e.stack,
      );
      throw new InternalServerErrorException('No se pudo subir el archivo');
    }

    return { url: this.publicUrl(key), key };
  }

  async deleteKey(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`Delete failed for key ${key}: ${(err as Error).message}`);
    }
  }

  publicUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/+$/, '')}/${key}`;
    }
    // Sin CDN: DO Spaces soporta tanto virtual-hosted como path-style.
    // Usamos virtual-hosted para URLs más "limpias" en público:
    //   https://{bucket}.{host}/{key}
    const host = this.endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${this.bucket}.${host}/${key}`;
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mime] ?? '';
  }
}
