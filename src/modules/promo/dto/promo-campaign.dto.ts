import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromoCampaignDto {
  @ApiProperty({ description: 'Nombre de la campaña (interno)' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Inicio de la ventana (ISO o YYYY-MM-DD)' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ description: 'Fin de la ventana (ISO o YYYY-MM-DD)' })
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    description: '% del cupón-regalo (ej. 20). Omitir = campaña sin recompensa.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rewardDiscountPercent?: number;

  @ApiProperty({ required: false, default: 90, description: 'Validez del cupón-regalo en días' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  rewardValidityDays?: number;

  @ApiProperty({
    required: false,
    default: true,
    description: 'El cupón-regalo excluye las formaciones que el alumno ya compró.',
  })
  @IsOptional()
  @IsBoolean()
  rewardExcludeOwned?: boolean;
}

export class UpdatePromoCampaignDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rewardDiscountPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  rewardValidityDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  rewardExcludeOwned?: boolean;
}
