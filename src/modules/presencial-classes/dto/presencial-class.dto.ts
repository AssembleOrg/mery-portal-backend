import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePresencialClassDto {
  @ApiProperty({ description: 'Título (ej. "Presencial Estilismo")' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Fecha YYYY-MM-DD (hora Argentina)' })
  @Matches(DATE_RE, { message: 'date debe ser YYYY-MM-DD' })
  date: string;

  @ApiProperty({ description: 'Hora de inicio (9..17, formato 24hs)' })
  @IsInt()
  @Min(9)
  @Max(17)
  startHour: number;

  @ApiProperty({ description: 'Hora de fin (10..18, formato 24hs)' })
  @IsInt()
  @Min(10)
  @Max(18)
  endHour: number;

  @ApiProperty({ required: false, description: 'Formaciones (ids de categoría)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiProperty({ required: false, default: false, description: 'Solo alumnas de esas formaciones' })
  @IsOptional()
  @IsBoolean()
  restrictToStudents?: boolean;

  @ApiProperty({
    required: false,
    description: 'Seña del listado de precios. Sin seña la fecha no se puede reservar.',
  })
  @IsOptional()
  @IsString()
  priceId?: string | null;
}

export class UpdatePresencialClassDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date debe ser YYYY-MM-DD' })
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(9)
  @Max(17)
  startHour?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(18)
  endHour?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  restrictToStudents?: boolean;

  @ApiProperty({ required: false, description: 'null para sacarle la seña' })
  @IsOptional()
  @IsString()
  priceId?: string | null;
}

export class SignupDto {
  @ApiProperty({ required: false, description: 'Comentario opcional de la alumna' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class StartDepositDto {
  @ApiProperty({
    description:
      'La alumna leyó y aceptó que reserva el derecho a una presencialidad, no una fecha fija.',
  })
  @IsBoolean()
  acceptedDisclaimer: boolean;
}

export class CreatePresencialPriceDto {
  @ApiProperty({ description: 'Nombre visible (ej. "Nanoblading")' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, description: 'Seña en dólares (se convierte a pesos al cobrar)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountUSD?: number | null;

  @ApiProperty({ required: false, description: 'Seña en pesos. Si viene, manda sobre el monto en USD.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountARS?: number | null;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePresencialPriceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountUSD?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountARS?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ReschedulePresencialClassDto {
  @ApiProperty({ description: 'Nueva fecha YYYY-MM-DD (hora Argentina)' })
  @Matches(DATE_RE, { message: 'date debe ser YYYY-MM-DD' })
  date: string;

  @ApiProperty({ description: 'Nueva hora de inicio (9..17)' })
  @IsInt()
  @Min(9)
  @Max(17)
  startHour: number;

  @ApiProperty({ description: 'Nueva hora de fin (10..18)' })
  @IsInt()
  @Min(10)
  @Max(18)
  endHour: number;
}
