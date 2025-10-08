import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

export class UserResponseDto {
  @ApiProperty({ example: 'clx123456789', description: 'ID único del usuario' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  email: string;

  @ApiProperty({ example: 'USER', description: 'Rol del usuario', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario', required: false })
  firstName?: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario', required: false })
  lastName?: string;

  @ApiProperty({ example: true, description: 'Estado activo del usuario' })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de última actualización' })
  updatedAt: Date;

  @ApiProperty({ example: null, description: 'Fecha de eliminación (soft delete)', required: false })
  deletedAt?: Date;
}
