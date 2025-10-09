import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UploadVideoDto {
  @ApiProperty({
    example: 'Técnica Avanzada de Microblading',
    description: 'Título del video',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: 'En este video aprenderás las técnicas más avanzadas de microblading...',
    description: 'Descripción del video',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'clx123...',
    description: 'ID de la categoría/curso al que pertenece el video',
  })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: 1,
    description: 'Orden del video dentro de la categoría (0 = video de preview gratis)',
    required: false,
  })
  @IsOptional()
  order?: number;

  @ApiProperty({
    example: false,
    description: 'Si el video debe publicarse inmediatamente',
    required: false,
  })
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo de video (máx 2GB)',
  })
  file: any;
}

