import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ExtendRoomDto {
  @ApiProperty({
    required: false,
    description:
      'Días a extender la vida del chat. Si se omite, usa los días de vida configurados (default 30).',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días deben ser un número entero' })
  @Min(1)
  @Max(3650)
  days?: number;
}
