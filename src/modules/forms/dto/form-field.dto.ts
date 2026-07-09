import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const FORM_FIELD_TYPES = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'yesno',
  'info',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export class FormFieldOptionDto {
  @ApiPropertyOptional({ description: 'ID estable de la opción (se genera si falta)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Texto visible de la opción' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  label: string;
}

export class FormFieldDto {
  @ApiPropertyOptional({ description: 'ID estable del campo (se genera si falta)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES })
  @IsIn(FORM_FIELD_TYPES as unknown as string[])
  type: FormFieldType;

  @ApiProperty({ description: 'Etiqueta / título del campo' })
  @IsString()
  @MaxLength(500)
  label: string;

  @ApiPropertyOptional({ description: 'Texto de ayuda o contenido (para bloques info)' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  placeholder?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [FormFieldOptionDto], description: 'Opciones para select/radio/checkbox' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @ApiPropertyOptional({ description: 'yesno: permite aclarar contexto en texto libre' })
  @IsOptional()
  @IsBoolean()
  allowContext?: boolean;

  @ApiPropertyOptional({ description: 'yesno: etiqueta del campo de contexto' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  contextLabel?: string;
}
