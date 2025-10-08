import { IsOptional, IsBoolean, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ example: 'newpassword123', description: 'Nueva contraseña del usuario', required: false })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @ApiProperty({ example: true, description: 'Estado activo del usuario', required: false })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un booleano' })
  isActive?: boolean;
}
