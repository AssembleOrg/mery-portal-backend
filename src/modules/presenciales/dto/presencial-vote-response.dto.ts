import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PresencialVoteResponseDto {
  @Expose()
  @ApiProperty({ example: 'clx123...', description: 'ID del voto' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'clx456...', description: 'ID de la encuesta' })
  poll_id: string;

  @Expose()
  @ApiProperty({ example: 'clx789...', description: 'ID de la opción seleccionada' })
  option_id: string;

  @Expose()
  @ApiProperty({ example: 'clxabc...', description: 'ID del usuario' })
  user_id: string;

  @Expose()
  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre del usuario', required: false })
  user_name?: string | null;

  @Expose()
  @ApiProperty({ example: '2024-12-05T14:30:00Z', description: 'Fecha del voto en formato ISO 8601' })
  voted_at: string;
}



