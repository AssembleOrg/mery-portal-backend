import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Token JWT' })
  accessToken: string;

  @ApiProperty({ example: '24h', description: 'Tiempo de expiración del token' })
  expiresIn: string;

  @ApiProperty({ example: 'USER', description: 'Rol del usuario', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  email: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario', required: false })
  firstName?: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario', required: false })
  lastName?: string;
}
