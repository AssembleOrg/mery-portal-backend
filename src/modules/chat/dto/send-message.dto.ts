import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ required: false, description: 'Texto del mensaje' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @ApiProperty({ required: false, description: 'URL pública de la imagen (previamente subida)' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false, description: 'Key del objeto en el storage (para posibles borrados)' })
  @IsOptional()
  @IsString()
  imageKey?: string;
}
