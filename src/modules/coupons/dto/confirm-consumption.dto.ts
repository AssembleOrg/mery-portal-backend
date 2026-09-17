import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Reserva de un uso de cupón para una preference de Mercado Pago recién
 * creada. El usuario sale del JWT, nunca del body.
 */
export class ConfirmConsumptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  couponId: string;

  @ApiProperty({ description: 'ID de la preference de Mercado Pago' })
  @IsString()
  @MinLength(1)
  preferenceId: string;

  /** Compatibilidad con el front actual: se acepta pero se ignora (manda el JWT). */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  userId?: string;
}
