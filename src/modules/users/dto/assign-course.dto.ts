import { IsNumber, IsString, IsOptional, Min, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const COURSE_ACCESS_DURATIONS_MONTHS = [3, 6, 12] as const;
export type CourseAccessDurationMonths =
  (typeof COURSE_ACCESS_DURATIONS_MONTHS)[number];

export class AssignCourseDto {
  @ApiProperty({
    description: 'Precio al momento de la asignación (usar 0 para asignaciones gratuitas)',
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Moneda del precio',
    example: 'ARS',
    enum: ['ARS', 'USD'],
  })
  @IsString()
  currency: string;

  @ApiPropertyOptional({
    description: 'Método de pago (ej: "efectivo", "transferencia", "cortesía")',
    example: 'efectivo',
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la asignación',
    example: 'Pago en efectivo - Asignación manual',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Duración del acceso en meses (3, 6 o 12). Default: 12.',
    example: 12,
    enum: COURSE_ACCESS_DURATIONS_MONTHS,
  })
  @IsNumber()
  @IsIn([...COURSE_ACCESS_DURATIONS_MONTHS])
  @IsOptional()
  durationMonths?: CourseAccessDurationMonths;
}

export class RenewCourseDto {
  @ApiProperty({
    description: 'Duración de la renovación en meses (3, 6 o 12)',
    example: 6,
    enum: COURSE_ACCESS_DURATIONS_MONTHS,
  })
  @IsNumber()
  @IsIn([...COURSE_ACCESS_DURATIONS_MONTHS])
  durationMonths: CourseAccessDurationMonths;

  @ApiPropertyOptional({
    description: 'Precio cobrado por la renovación (pago manejado fuera de la plataforma)',
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Moneda del precio',
    example: 'ARS',
    enum: ['ARS', 'USD'],
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Método de pago (ej: "efectivo", "transferencia", "cortesía")',
    example: 'transferencia',
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
