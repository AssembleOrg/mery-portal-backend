import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryQueryDto {
  @ApiProperty({ example: 1, description: 'Número de página', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'page debe ser un número' })
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 10, description: 'Cantidad de resultados por página', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'limit debe ser un número' })
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ example: 'cejas', description: 'Búsqueda por nombre o descripción', required: false })
  @IsOptional()
  @IsString({ message: 'search debe ser una cadena de texto' })
  search?: string;

  @ApiProperty({ example: true, description: 'Filtrar por categorías activas', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ 
    example: 'order', 
    description: 'Campo por el cual ordenar', 
    enum: ['name', 'order', 'createdAt'],
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'sortBy debe ser una cadena de texto' })
  sortBy?: string = 'order';

  @ApiProperty({ 
    example: 'asc', 
    description: 'Orden ascendente o descendente', 
    enum: ['asc', 'desc'],
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'sortOrder debe ser una cadena de texto' })
  sortOrder?: 'asc' | 'desc' = 'asc';
}

