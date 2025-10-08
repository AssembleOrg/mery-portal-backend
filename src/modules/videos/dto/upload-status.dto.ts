import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UploadStatusDto {
  @ApiProperty({
    example: 'processing',
    description: 'Estado del video en Vimeo',
    enum: ['uploading', 'processing', 'available', 'error'],
  })
  @Expose()
  status: 'uploading' | 'processing' | 'available' | 'error';

  @ApiProperty({
    example: 75,
    description: 'Progreso de procesamiento (opcional)',
    required: false,
  })
  @Expose()
  progress?: number;

  @ApiProperty({
    example: 'El video está siendo procesado por Vimeo. Esto puede tomar varios minutos.',
    description: 'Mensaje descriptivo del estado',
  })
  @Expose()
  message: string;
}

