import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CampaignRecipientDto {
  @ApiProperty({ example: 'cliente@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Agustina Aranda' })
  @IsString()
  @MaxLength(120)
  name: string;
}
