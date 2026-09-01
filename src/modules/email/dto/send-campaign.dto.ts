import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SendCampaignDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de clientes a incluir',
    default: 150,
    maximum: 150,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(150)
  limit = 150;

  @ApiPropertyOptional({
    description: 'Debe ser true para ejecutar el envío. False devuelve una vista previa.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirm = false;
}
