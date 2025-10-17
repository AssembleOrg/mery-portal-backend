import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

/**
 * DTO de respuesta para /auth/me
 * Retorna la información completa del usuario desde la base de datos
 */
export class MeResponseDto {
  @ApiProperty({ 
    example: 'clx123456789', 
    description: 'ID único del usuario' 
  })
  id: string;

  @ApiProperty({ 
    example: 'user@example.com', 
    description: 'Email del usuario' 
  })
  email: string;

  @ApiPropertyOptional({ 
    example: 'Juan', 
    description: 'Nombre del usuario' 
  })
  firstName?: string;

  @ApiPropertyOptional({ 
    example: 'Pérez', 
    description: 'Apellido del usuario' 
  })
  lastName?: string;

  @ApiPropertyOptional({ 
    example: 'Juan Pérez', 
    description: 'Nombre completo del usuario' 
  })
  name?: string;

  @ApiPropertyOptional({ 
    example: '+54 9 11 1234-5678', 
    description: 'Teléfono del usuario' 
  })
  phone?: string;

  @ApiPropertyOptional({ 
    example: 'Argentina', 
    description: 'País del usuario' 
  })
  country?: string;

  @ApiPropertyOptional({ 
    example: 'Buenos Aires', 
    description: 'Ciudad del usuario' 
  })
  city?: string;

  @ApiProperty({ 
    example: 'USER', 
    description: 'Rol del usuario', 
    enum: UserRole 
  })
  role: UserRole;

  @ApiProperty({ 
    example: true, 
    description: 'Indica si el usuario está activo' 
  })
  isActive: boolean;

  @ApiProperty({ 
    example: true, 
    description: 'Indica si el email está verificado' 
  })
  emailVerified: boolean;

  @ApiProperty({ 
    example: '2024-10-17T10:00:00.000Z', 
    description: 'Fecha de creación de la cuenta' 
  })
  createdAt: string;
}

