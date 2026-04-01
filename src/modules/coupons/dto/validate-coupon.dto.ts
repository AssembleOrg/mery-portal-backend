import { IsNotEmpty, IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'mery-20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: ['cat-id-1', 'cat-id-2'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  categoryIds: string[];
}
