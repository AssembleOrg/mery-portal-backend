import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class RecentRequestDto {
  @ApiProperty({ example: 'GET' })
  @IsString({ message: 'El método HTTP debe ser una cadena de texto' })
  method: string;

  @ApiProperty({ example: '/categories?page=1&limit=12' })
  @IsString({ message: 'La URL debe ser una cadena de texto' })
  url: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber({}, { message: 'El statusCode debe ser numérico' })
  statusCode?: number;

  @ApiProperty({ example: '2026-04-03T08:53:10.305Z' })
  @IsString({ message: 'El timestamp debe ser una cadena de texto' })
  timestamp: string;

  @ApiPropertyOptional({ example: 445 })
  @IsOptional()
  @IsNumber({}, { message: 'El durationMs debe ser numérico' })
  durationMs?: number;

  @ApiPropertyOptional({
    description: 'Body enviado en la request (cuando aplica)',
    example: '{"email":"test@example.com"}',
  })
  @IsOptional()
  body?: unknown;

  @ApiPropertyOptional({
    description: 'Respuesta de error o payload relevante de la respuesta',
    example: { success: false, message: 'Unauthorized', statusCode: 401 },
  })
  @IsOptional()
  response?: unknown;
}

export class CreateProblemReportDto {
  @ApiPropertyOptional({ example: '+5491123456789' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ example: 'No puedo finalizar el checkout' })
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es requerida' })
  description: string;

  @ApiPropertyOptional({
    description: 'Últimas requests HTTP del usuario',
    type: [RecentRequestDto],
  })
  @IsOptional()
  @IsArray({ message: 'recentRequests debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => RecentRequestDto)
  recentRequests?: RecentRequestDto[];
}
