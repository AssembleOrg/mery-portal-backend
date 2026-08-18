import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class QuoteDto {
  @ApiProperty({ type: [String], description: 'IDs de las categorías a comprar' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categoryIds: string[];

  @ApiProperty({ required: false, description: 'Código de cupón (opcional)' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({ required: false, description: 'Plan de cuotas pedido (2, 3 o 6)' })
  @IsOptional()
  @IsInt()
  installments?: number;
}
