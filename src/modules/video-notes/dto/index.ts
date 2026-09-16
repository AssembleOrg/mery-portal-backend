import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVideoNoteDto {
  @ApiProperty({ description: 'Video al que pertenece la nota' })
  @IsString()
  videoId: string;

  @ApiProperty({ description: 'Segundo del video al que refiere la nota', minimum: 0 })
  @IsInt()
  @Min(0)
  timeSeconds: number;

  @ApiProperty({ description: 'Texto de la nota', maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class UpdateVideoNoteDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSeconds?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;
}
