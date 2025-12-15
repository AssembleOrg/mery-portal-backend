import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString, IsObject, ValidateNested, ArrayMinSize, MinLength, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class PollOptionDto {
  @ApiProperty({ example: '2024-12-15', description: 'Fecha en formato YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '14:00', description: 'Hora de inicio en formato HH:mm' })
  @IsString()
  @IsNotEmpty()
  start_time: string;

  @ApiProperty({ example: 120, description: 'Duración en minutos', default: 120 })
  @IsOptional()
  duration_minutes?: number;
}

class UserOverrideDto {
  @ApiProperty({ example: 'clx123...', description: 'ID del usuario', required: false })
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario', required: false })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiProperty({ example: true, description: 'Si el usuario tiene permiso' })
  @IsBoolean()
  allowed: boolean;
}

class EligibilityDto {
  @ApiProperty({ example: ['clx123...', 'clx456...'], description: 'IDs de cursos que dan acceso', type: [String] })
  @IsArray()
  @IsString({ each: true })
  courseIds: string[];

  @ApiProperty({ 
    example: [{ userId: 'clx123...', email: null, allowed: true }], 
    description: 'Overrides de usuarios específicos',
    type: [UserOverrideDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserOverrideDto)
  userOverrides: UserOverrideDto[];
}

export class CreatePresencialPollDto {
  @ApiProperty({ example: 'Encuesta de horarios - Diciembre 2024', description: 'Título de la encuesta' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title: string;

  @ApiProperty({ 
    example: 'Selecciona tu horario preferido para la clase presencial', 
    description: 'Descripción de la encuesta',
    required: false 
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ 
    example: '2024-12-10', 
    description: 'Fecha límite en formato YYYY-MM-DD',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  deadline_at?: string | null;

  @ApiProperty({ 
    example: [
      { date: '2024-12-15', start_time: '14:00', duration_minutes: 120 },
      { date: '2024-12-16', start_time: '15:00', duration_minutes: 120 }
    ], 
    description: 'Opciones de horarios',
    type: [PollOptionDto]
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos una opción' })
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options: PollOptionDto[];

  @ApiProperty({ 
    example: { courseIds: ['clx123...'], userOverrides: [] }, 
    description: 'Reglas de elegibilidad',
    type: EligibilityDto
  })
  @IsObject()
  @ValidateNested()
  @Type(() => EligibilityDto)
  eligibility: EligibilityDto;
}

