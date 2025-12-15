import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum PresencialPollStatus {
  draft = 'draft',
  open = 'open',
  closed = 'closed',
}

export class PresencialPollQueryDto {
  @ApiProperty({ example: 1, description: 'Número de página', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, description: 'Límite de resultados por página', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ 
    example: 'open', 
    description: 'Filtrar por estado',
    enum: PresencialPollStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(PresencialPollStatus)
  status?: PresencialPollStatus;
}

