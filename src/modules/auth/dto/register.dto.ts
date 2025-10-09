import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña del usuario' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
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
  //reba added:
  @ApiProperty({ example: '+5491112345678', description: 'Teléfono del usuario', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim()) 
  phone?: string;

  @ApiProperty({ example: 'Argentina', description: 'País del usuario', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Buenos Aires', description: 'Ciudad del usuario', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim()) 
  city?: string;
}
