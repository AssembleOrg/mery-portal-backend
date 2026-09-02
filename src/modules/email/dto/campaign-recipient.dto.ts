import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CampaignRecipientDto {
  @ApiProperty({ required: false, description: 'Identificador interno usado por la vista previa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @ApiProperty({ example: 'cliente@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Agustina Aranda' })
  @IsString()
  @MaxLength(120)
  name: string;
}
