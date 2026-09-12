import { ApiProperty } from '@nestjs/swagger';
import { MentorshipProductType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class BookMentorshipDto {
  @ApiProperty({ description: 'Curso (categoría) para el que se agenda la mentoría' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Inicio del horario elegido (ISO)' })
  @IsDateString()
  start: string;

  @ApiProperty({ description: 'Email para la meet (default = email logueado)' })
  @IsEmail()
  meetingEmail: string;
}

export class RescheduleMentorshipDto {
  @ApiProperty({ description: 'Nuevo inicio del horario (ISO)' })
  @IsDateString()
  start: string;
}

export class CreateAvailabilityDto {
  @ApiProperty({ description: '0=Domingo … 1=Lunes … 6=Sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ description: 'Inicio en minutos desde 00:00 (720 = 12:00)' })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin: number;

  @ApiProperty({ description: 'Fin en minutos desde 00:00 (780 = 13:00)' })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMin: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// --------------------- Productos pagos + variantes ---------------------

export class CreateProductDto {
  @ApiProperty({ description: 'Nombre del producto (ej. "Mentoría Estilismo")' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, enum: MentorshipProductType, default: 'MENTORSHIP' })
  @IsOptional()
  @IsEnum(MentorshipProductType)
  type?: MentorshipProductType;

  @ApiProperty({ required: false, description: 'Curso asociado (opcional)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, enum: MentorshipProductType })
  @IsOptional()
  @IsEnum(MentorshipProductType)
  type?: MentorshipProductType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateVariantDto {
  @ApiProperty({ description: 'Etiqueta (ej. "Transferencia", "Efectivo", "Exterior")' })
  @IsString()
  label: string;

  @ApiProperty({ description: 'Monto' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false, default: 'ARS', enum: ['ARS', 'USD'] })
  @IsOptional()
  @IsIn(['ARS', 'USD'])
  currency?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateVariantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ required: false, enum: ['ARS', 'USD'] })
  @IsOptional()
  @IsIn(['ARS', 'USD'])
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// --------------------- Crédito pago (validación manual) ---------------------

export class GrantCreditDto {
  @ApiProperty({ description: 'Alumno al que se le otorga el crédito' })
  @IsString()
  userId: string;

  @ApiProperty({ required: false, description: 'Producto comprado (deriva tipo/curso/monto)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false, description: 'Curso asociado (si no hay producto)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, enum: MentorshipProductType })
  @IsOptional()
  @IsEnum(MentorshipProductType)
  type?: MentorshipProductType;

  @ApiProperty({ required: false, description: 'Monto pagado (registro)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ required: false, enum: ['ARS', 'USD'] })
  @IsOptional()
  @IsIn(['ARS', 'USD'])
  currency?: string;

  @ApiProperty({ required: false, description: 'Nota interna (ej. comprobante)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMin?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
