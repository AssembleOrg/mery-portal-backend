import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../../../shared/utils';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del usuario' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;
}
