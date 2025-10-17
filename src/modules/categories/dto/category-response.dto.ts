import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CategoryResponseDto {
  @Expose()
  @ApiProperty({ example: 'clx123...', description: 'ID de la categoría' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Cejas', description: 'Nombre de la categoría' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'cejas', description: 'Slug único de la categoría' })
  slug: string;

  @Expose()
  @ApiProperty({ 
    example: 'Técnicas y tutoriales de microblading y diseño de cejas', 
    description: 'Descripción corta de la categoría',
    required: false 
  })
  description?: string;

  @Expose()
  @ApiProperty({ 
    example: 'En este curso aprenderás todas las técnicas profesionales de microblading, diseño de cejas y mucho más. Incluye prácticas, casos reales y certificación.', 
    description: 'Descripción larga y detallada de la categoría',
    required: false 
  })
  longdescription?: string;

  @Expose()
  @ApiProperty({ 
    example: 'https://example.com/images/cejas.jpg', 
    description: 'URL de la imagen de la categoría',
    required: false 
  })
  image?: string;

  @Expose()
  @ApiProperty({ 
    example: 'Profesionales de belleza y principiantes', 
    description: 'Público objetivo o target del curso',
    required: false 
  })
  target?: string;

  @Expose()
  @ApiProperty({ example: 0, description: 'Orden de la categoría en la lista' })
  order: number;

  @Expose()
  @ApiProperty({ example: true, description: 'Si la categoría está activa' })
  isActive: boolean;

  @Expose()
  @ApiProperty({ example: 4999.99, description: 'Precio del curso en pesos argentinos (ARS)' })
  priceARS: number;

  @Expose()
  @ApiProperty({ example: 49.99, description: 'Precio del curso en dólares (USD)' })
  priceUSD: number;

  @Expose()
  @ApiProperty({ example: false, description: 'Si el curso es gratuito' })
  isFree: boolean;

  @Expose()
  @ApiProperty({ example: 5, description: 'Número de videos en la categoría', required: false })
  videoCount?: number;

  @Expose()
  @ApiProperty({ example: false, description: 'Si el usuario tiene acceso a este curso', required: false })
  hasAccess?: boolean;

  @Expose()
  @ApiProperty({ example: false, description: 'Si el usuario ya compró este curso', required: false })
  isPurchased?: boolean;

  @Expose()
  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Fecha de creación' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Fecha de última actualización' })
  updatedAt: Date;
}

