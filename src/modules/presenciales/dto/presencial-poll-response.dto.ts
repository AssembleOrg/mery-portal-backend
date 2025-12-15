import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

export class PresencialPollOptionResponseDto {
  @Expose()
  @ApiProperty({ example: 'clx123...', description: 'ID de la opción' })
  id: string;

  @Expose()
  @ApiProperty({ example: '2024-12-15', description: 'Fecha en formato YYYY-MM-DD' })
  date: string;

  @Expose()
  @ApiProperty({ example: '14:00', description: 'Hora de inicio en formato HH:mm' })
  start_time: string;

  @Expose()
  @ApiProperty({ example: 120, description: 'Duración en minutos' })
  duration_minutes: number;
}

export class UserOverrideResponseDto {
  @Expose()
  @ApiProperty({ example: 'clx123...', description: 'ID del usuario', required: false })
  userId?: string | null;

  @Expose()
  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario', required: false })
  email?: string | null;

  @Expose()
  @ApiProperty({ example: true, description: 'Si el usuario tiene permiso' })
  allowed: boolean;
}

export class EligibilityResponseDto {
  @Expose()
  @ApiProperty({ example: ['clx123...'], description: 'IDs de cursos que dan acceso', type: [String] })
  courseIds: string[];

  @Expose()
  @ApiProperty({ 
    example: [{ userId: 'clx123...', email: null, allowed: true }], 
    description: 'Overrides de usuarios específicos',
    type: [UserOverrideResponseDto]
  })
  @Type(() => UserOverrideResponseDto)
  userOverrides: UserOverrideResponseDto[];
}

@Exclude()
export class PresencialPollResponseDto {
  @Expose()
  @ApiProperty({ example: 'clx123...', description: 'ID de la encuesta' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Encuesta de horarios - Diciembre 2024', description: 'Título de la encuesta' })
  title: string;

  @Expose()
  @ApiProperty({ 
    example: 'Selecciona tu horario preferido', 
    description: 'Descripción de la encuesta',
    required: false 
  })
  description?: string | null;

  @Expose()
  @ApiProperty({ 
    example: 'open', 
    description: 'Estado de la encuesta',
    enum: ['draft', 'open', 'closed']
  })
  status: 'draft' | 'open' | 'closed';

  @Expose()
  @ApiProperty({ 
    example: '2024-12-10T00:00:00Z', 
    description: 'Fecha límite en formato ISO 8601',
    required: false 
  })
  deadline_at?: string | null;

  @Expose()
  @ApiProperty({ 
    description: 'Opciones de horarios',
    type: [PresencialPollOptionResponseDto]
  })
  @Type(() => PresencialPollOptionResponseDto)
  options: PresencialPollOptionResponseDto[];

  @Expose()
  @ApiProperty({ 
    example: '2024-12-01T10:00:00Z', 
    description: 'Fecha de creación en formato ISO 8601'
  })
  created_at: string;

  @Expose()
  @ApiProperty({ 
    description: 'Reglas de elegibilidad',
    type: EligibilityResponseDto
  })
  @Type(() => EligibilityResponseDto)
  eligibility: EligibilityResponseDto;
}

