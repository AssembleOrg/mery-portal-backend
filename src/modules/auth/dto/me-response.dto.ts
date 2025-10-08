import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

/**
 * DTO de respuesta para /auth/me
 * Retorna solo la información contenida en el JWT (sin consultar la base de datos)
 */
export class MeResponseDto {
  @ApiProperty({ 
    example: 'clx123456789', 
    description: 'ID único del usuario (del JWT)' 
  })
  id: string;

  @ApiProperty({ 
    example: 'user@example.com', 
    description: 'Email del usuario (del JWT)' 
  })
  email: string;

  @ApiProperty({ 
    example: 'USER', 
    description: 'Rol del usuario (del JWT)', 
    enum: UserRole 
  })
  role: UserRole;
}

