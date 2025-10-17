import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Cejas', description: 'Nombre de la categoría' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @ApiProperty({ example: 'cejas', description: 'Slug único de la categoría' })
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El slug es requerido' })
  slug: string;

  @ApiProperty({ 
    example: 'Técnicas y tutoriales de microblading y diseño de cejas', 
    description: 'Descripción corta de la categoría',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @ApiProperty({ 
    example: 'En este curso aprenderás todas las técnicas profesionales de microblading, diseño de cejas y mucho más. Incluye prácticas, casos reales y certificación.', 
    description: 'Descripción larga y detallada de la categoría',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'La descripción larga debe ser una cadena de texto' })
  longdescription?: string;

  @ApiProperty({ 
    example: 'https://example.com/images/cejas.jpg', 
    description: 'URL de la imagen de la categoría',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'La imagen debe ser una cadena de texto' })
  image?: string;

  @ApiProperty({ 
    example: 'Profesionales de belleza y principiantes', 
    description: 'Público objetivo o target del curso',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'El target debe ser una cadena de texto' })
  target?: string;

  @ApiProperty({ example: 0, description: 'Orden de la categoría en la lista', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'El orden debe ser un número' })
  @Type(() => Number)
  order?: number = 0;

  @ApiProperty({ example: true, description: 'Si la categoría está activa', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  @Type(() => Boolean)
  isActive?: boolean = true;

  @ApiProperty({ example: 4999.99, description: 'Precio del curso en pesos argentinos (ARS)' })
  @IsNumber({}, { message: 'El precio en ARS debe ser un número' })
  @IsNotEmpty({ message: 'El precio en ARS es requerido' })
  @Min(0, { message: 'El precio en ARS debe ser mayor o igual a 0' })
  @Type(() => Number)
  priceARS: number;

  @ApiProperty({ example: 49.99, description: 'Precio del curso en dólares estadounidenses (USD)' })
  @IsNumber({}, { message: 'El precio en USD debe ser un número' })
  @IsNotEmpty({ message: 'El precio en USD es requerido' })
  @Min(0, { message: 'El precio en USD debe ser mayor o igual a 0' })
  @Type(() => Number)
  priceUSD: number;

  @ApiProperty({ example: false, description: 'Si el curso es gratuito', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isFree debe ser un booleano' })
  @Type(() => Boolean)
  isFree?: boolean = false;
}

