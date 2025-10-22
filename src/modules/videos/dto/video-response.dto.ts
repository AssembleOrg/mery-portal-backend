import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { CategoryNestedDto } from './category-nested.dto';

@Exclude()
export class VideoResponseDto {
  @ApiProperty({ example: 'clx123...', description: 'ID del video' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Técnica de Microblading', description: 'Título del video' })
  @Expose()
  title: string;

  @ApiProperty({ example: 'Aprende la técnica completa...', description: 'Descripción del video' })
  @Expose()
  description?: string;

  @ApiProperty({ example: 'https://i.vimeocdn.com/...', description: 'URL del thumbnail' })
  @Expose()
  thumbnail?: string;

  @ApiProperty({ example: 1800, description: 'Duración en segundos' })
  @Expose()
  duration?: number;

  @ApiProperty({ example: 'clx123...', description: 'ID de la categoría/curso' })
  @Expose()
  categoryId: string;

  @ApiProperty({ example: { id: 'clx123...', name: 'Cejas', slug: 'cejas' }, description: 'Curso/Categoría del video' })
  @Expose()
  @Type(() => CategoryNestedDto)
  category?: CategoryNestedDto;

  @ApiProperty({ example: 0, description: 'Orden del video en la lista (0 = video de preview gratis)' })
  @Expose()
  order: number;

  @ApiProperty({ example: true, description: 'Si está publicado' })
  @Expose()
  isPublished: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de publicación' })
  @Expose()
  publishedAt?: Date;

  @ApiProperty({ 
    example: '1. Introducción al microblading\n2. Materiales necesarios\n3. Técnica paso a paso\n4. Cuidados post-procedimiento', 
    description: 'Contenidos del video (temario/syllabus)',
    required: false 
  })
  @Expose()
  contenidos?: string;

  @ApiProperty({ 
    example: { 
      files: [
        { name: 'Guía de Microblading.pdf', url: 'https://example.com/guia.pdf' },
        { name: 'Plantillas descargables.zip', url: 'https://example.com/plantillas.zip' }
      ]
    }, 
    description: 'Recursos descargables (estructura JSON)',
    required: false 
  })
  @Expose()
  downloads?: any;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de creación' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de actualización' })
  @Expose()
  updatedAt: Date;

  // El vimeoId solo se expone para ADMIN y SUBADMIN
  @ApiProperty({ 
    example: '123456789', 
    description: 'ID del video en Vimeo (solo para ADMIN/SUBADMIN)',
    required: false,
  })
  @Expose({ groups: ['admin'] })
  vimeoId?: string;

  // El vimeoUrl NO se expone nunca por seguridad
}
