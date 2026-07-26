import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddTokensDto {
  @ApiProperty({
    description:
      'Tokens a sumar. Puede ser 1, o varios de una (ej. el límite completo). Usar valores negativos para restar.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  amount: number;

  @ApiProperty({ required: false, description: 'Motivo interno (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ResetTokensDto {
  @ApiProperty({ required: false, description: 'Motivo interno (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
