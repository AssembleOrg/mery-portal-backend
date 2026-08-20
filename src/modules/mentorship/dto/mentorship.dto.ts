import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
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
