import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../../../shared/utils';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña del usuario' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  //@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}
