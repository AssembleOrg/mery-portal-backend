import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @ApiPropertyOptional({ example: 'mery-20' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsNotEmpty()
  @Type(() => Number)
  discountPercent: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsDateString()
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxUses?: number;

  @ApiPropertyOptional({ example: ['cid1', 'cid2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  appliesToAll?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
