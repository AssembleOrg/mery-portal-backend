import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuickReplyDto {
  @ApiProperty({ description: 'Título corto para identificar/buscar la respuesta' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: 'Cuerpo del mensaje que se inserta en el chat' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class UpdateQuickReplyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body?: string;
}

export class ListQuickRepliesDto {
  @ApiProperty({ required: false, description: 'Filtro por título' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
