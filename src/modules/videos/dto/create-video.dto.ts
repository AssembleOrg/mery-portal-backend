import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, IsDecimal } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateVideoDto {
  @ApiProperty({ example: 'Técnica de Microblading paso a paso', description: 'Título del video' })
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El título es requerido' })
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({ example: 'tecnica-microblading-paso-a-paso', description: 'Slug único del video' })
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El slug es requerido' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug: string;

  @ApiProperty({ 
    example: 'Aprende la técnica completa de microblading para cejas perfectas', 
    description: 'Descripción del video',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @ApiProperty({ example: '123456789', description: 'ID del video en Vimeo' })
  @IsString({ message: 'El ID de Vimeo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El ID de Vimeo es requerido' })
  vimeoId: string;

  @ApiProperty({ example: 'clx123...', description: 'ID de la categoría/curso' })
  @IsString({ message: 'El ID de categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La categoría es requerida' })
  categoryId: string;

  @ApiProperty({ example: 0, description: 'Orden del video en la lista', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'El orden debe ser un número' })
  @Type(() => Number)
  order?: number = 0;

  @ApiProperty({ example: true, description: 'Si el video está publicado', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isPublished debe ser un booleano' })
  @Type(() => Boolean)
  isPublished?: boolean = false;

  @ApiProperty({ example: 'Técnica de Microblading | Tutorial Completo', description: 'Meta título para SEO', required: false })
  @IsOptional()
  @IsString({ message: 'El meta título debe ser una cadena de texto' })
  metaTitle?: string;

  @ApiProperty({ example: 'Aprende la técnica completa de microblading...', description: 'Meta descripción para SEO', required: false })
  @IsOptional()
  @IsString({ message: 'La meta descripción debe ser una cadena de texto' })
  metaDescription?: string;
}
