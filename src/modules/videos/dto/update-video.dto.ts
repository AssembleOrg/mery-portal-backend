import { PartialType } from '@nestjs/mapped-types';
import { CreateVideoDto } from './create-video.dto';
import { IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateVideoDto extends PartialType(CreateVideoDto) {
  @ApiProperty({ example: true, description: 'Si el video está publicado', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isPublished debe ser un booleano' })
  @Type(() => Boolean)
  isPublished?: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de publicación', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'publishedAt debe ser una fecha válida' })
  publishedAt?: Date;
}
