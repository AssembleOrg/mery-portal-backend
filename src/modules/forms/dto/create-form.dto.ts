import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FormFieldDto } from './form-field.dto';

export class CreateFormDto {
  @ApiProperty({ description: 'Título del formulario' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({ description: 'Slug público (se genera del título si falta)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  slug?: string;

  @ApiPropertyOptional({ description: 'Descripción / subtítulo del formulario' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'closed'], default: 'draft' })
  @IsOptional()
  @IsIn(['draft', 'published', 'closed'])
  status?: 'draft' | 'published' | 'closed';

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiPropertyOptional({ description: 'Mensaje mostrado tras enviar' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  successMessage?: string;

  @ApiPropertyOptional({ description: 'Mensaje mostrado si el formulario está cerrado' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closedMessage?: string;

  @ApiPropertyOptional({ description: 'Texto del botón de envío' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submitLabel?: string;
}
