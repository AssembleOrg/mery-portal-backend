import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsDateString, IsObject, ValidateNested, IsEnum, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PollOptionDto } from './create-presencial-poll.dto';
import { EligibilityDto } from './create-presencial-poll.dto';

export enum PresencialPollStatus {
  draft = 'draft',
  open = 'open',
  closed = 'closed',
}

export class UpdatePresencialPollDto {
  @ApiProperty({ example: 'Encuesta de horarios - Diciembre 2024', description: 'Título de la encuesta', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title?: string;

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
    example: 'open', 
    description: 'Estado de la encuesta',
    enum: PresencialPollStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(PresencialPollStatus)
  status?: PresencialPollStatus;

  @ApiProperty({ 
    example: [
      { date: '2024-12-15', start_time: '14:00', duration_minutes: 120 }
    ], 
    description: 'Opciones de horarios',
    type: [PollOptionDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options?: PollOptionDto[];

  @ApiProperty({ 
    example: { courseIds: ['clx123...'], userOverrides: [] }, 
    description: 'Reglas de elegibilidad',
    type: EligibilityDto,
    required: false
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EligibilityDto)
  eligibility?: EligibilityDto;
}



