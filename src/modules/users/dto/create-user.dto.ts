import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '../../../shared/types';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña del usuario' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario', required: false })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario', required: false })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiProperty({ 
    example: 'USER', 
    description: 'Rol del usuario', 
    enum: UserRole,
    required: false 
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser válido' })
  role?: UserRole;
}
