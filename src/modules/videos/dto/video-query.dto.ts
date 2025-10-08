import { IsOptional, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class VideoQueryDto {
  @ApiProperty({ example: 1, description: 'Número de página', required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @ApiProperty({ example: 10, description: 'Elementos por página', required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  limit?: number = 10;

  @ApiProperty({ example: 'microblading', description: 'Búsqueda por texto', required: false })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiProperty({ example: 'title', description: 'Campo de ordenamiento', required: false })
  @IsOptional()
  @IsString({ message: 'El campo de ordenamiento debe ser una cadena de texto' })
  sortBy?: string = 'order';

  @ApiProperty({ example: 'asc', description: 'Orden de clasificación', required: false, enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString({ message: 'El orden debe ser una cadena de texto' })
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiProperty({ example: 'clx123...', description: 'Filtrar por categoría', required: false })
  @IsOptional()
  @IsString({ message: 'El ID de categoría debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  categoryId?: string;

  @ApiProperty({ example: true, description: 'Filtrar por publicados', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isPublished debe ser un booleano' })
  isPublished?: boolean;

  @ApiProperty({ example: true, description: 'Filtrar por gratuitos', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isFree debe ser un booleano' })
  isFree?: boolean;
}
