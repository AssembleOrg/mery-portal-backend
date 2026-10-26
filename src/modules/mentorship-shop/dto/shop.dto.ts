import { ApiProperty } from '@nestjs/swagger';
import { MentorshipPaymentMethod, MentorshipPromoKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ----------------------------- Alumna -----------------------------

export class CartLineDto {
  @ApiProperty({ enum: ['PRODUCT', 'PACK'] })
  @IsIn(['PRODUCT', 'PACK'])
  kind: 'PRODUCT' | 'PACK';

  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class ShopQuoteDto {
  @ApiProperty({ type: [CartLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  lines: CartLineDto[];

  @ApiProperty({ enum: MentorshipPaymentMethod })
  @IsEnum(MentorshipPaymentMethod)
  paymentMethod: MentorshipPaymentMethod;

  @ApiProperty({ required: false, description: 'Código de promo' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;
}

export class ShopCreateOrderDto extends ShopQuoteDto {}

export class GiftCreditDto {
  @ApiProperty({ description: 'Email de la cuenta que recibe la mentoría' })
  @IsEmail()
  email: string;
}

// ----------------------------- Admin -----------------------------

export class ShopProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  shopEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  shopOnly?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shopPriceARS?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shopPriceUSD?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  shopTagline?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  shopImageUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  shopDurationMin?: number | null;
}

export class PackItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class CreatePackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceARS?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceUSD?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ type: [PackItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PackItemDto)
  items: PackItemDto[];
}

export class UpdatePackDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceARS?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceUSD?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ required: false, type: [PackItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PackItemDto)
  items?: PackItemDto[];
}

export class PromoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: MentorshipPromoKind })
  @IsEnum(MentorshipPromoKind)
  kind: MentorshipPromoKind;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  buyQty?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  payQty?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  percent?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Vacío = se aplica sola',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,40}$/, {
    message: 'El código va sin espacios: letras, números, - o _ (3 a 40)',
  })
  code?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  appliesToAll?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  productIds?: string[];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReviewOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListOrdersQueryDto {
  @ApiProperty({
    required: false,
    enum: ['PENDING', 'PAID', 'CANCELLED', 'REJECTED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'CANCELLED', 'REJECTED'])
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | 'REJECTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
