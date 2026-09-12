import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
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
}

export class SignupDto {
  @ApiProperty({ required: false, description: 'Comentario opcional de la alumna' })
  @IsOptional()
  @IsString()
  note?: string;
}
