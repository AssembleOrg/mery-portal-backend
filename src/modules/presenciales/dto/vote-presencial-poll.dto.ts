import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VotePresencialPollDto {
  @ApiProperty({ example: 'clx123...', description: 'ID de la opción seleccionada' })
  @IsString()
  @IsNotEmpty({ message: 'El option_id es requerido' })
  option_id: string;
}

