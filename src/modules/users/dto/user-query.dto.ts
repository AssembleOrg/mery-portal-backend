import { IsOptional, IsString, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '../../../shared/types';

export class UserQueryDto {
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

  @ApiProperty({ example: 'usuario', description: 'Búsqueda por texto', required: false })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiProperty({ example: 'createdAt', description: 'Campo de ordenamiento', required: false })
  @IsOptional()
  @IsString({ message: 'El campo de ordenamiento debe ser una cadena de texto' })
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'desc', description: 'Orden de clasificación', required: false, enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString({ message: 'El orden debe ser una cadena de texto' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({ example: 'Juan', description: 'Buscar por nombre', required: false })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiProperty({ example: 'Pérez', description: 'Buscar por apellido', required: false })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiProperty({ example: 'USER', description: 'Filtrar por rol', enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser válido' })
  role?: UserRole;

  @ApiProperty({ example: true, description: 'Filtrar por estado activo', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'El estado activo debe ser un booleano' })
  isActive?: boolean;
}
