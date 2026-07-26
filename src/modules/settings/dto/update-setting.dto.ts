import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description: 'Nuevo valor de la configuración (se valida según su tipo)',
    example: '3',
  })
  @IsString()
  @IsNotEmpty()
  value: string;
}
