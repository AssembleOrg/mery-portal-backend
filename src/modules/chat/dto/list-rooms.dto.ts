import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListAdminRoomsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: ['LOCKED', 'ACTIVE', 'GRACE', 'CLOSED'] })
  @IsOptional()
  @IsIn(['LOCKED', 'ACTIVE', 'GRACE', 'CLOSED'])
  status?: 'LOCKED' | 'ACTIVE' | 'GRACE' | 'CLOSED';
}
