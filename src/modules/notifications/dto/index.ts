import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsUrl, ValidateNested } from 'class-validator';

class PushKeysDto {
  @ApiProperty()
  @IsString()
  p256dh: string;

  @ApiProperty()
  @IsString()
  auth: string;
}

export class PushSubscribeDto {
  @ApiProperty({ description: 'Endpoint del push service del navegador' })
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class PushUnsubscribeDto {
  @ApiProperty()
  @IsString()
  endpoint: string;
}
