import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}

