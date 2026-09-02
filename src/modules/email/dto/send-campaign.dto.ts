import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { CampaignRecipientDto } from './campaign-recipient.dto';

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
  @ArrayMaxSize(150)
  limit = 150;

  @ApiPropertyOptional({
    description: 'Debe ser true para ejecutar el envío. False devuelve una vista previa.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirm = false;

  @ApiPropertyOptional({
    description: 'Destinatarios seleccionados o importados desde CSV. Si se omite, se consulta la base de clientes.',
    type: [CampaignRecipientDto],
    maxItems: 150,
  })
  @IsOptional()
  @IsArray()
  @Max(150)
  @ValidateNested({ each: true })
  @Type(() => CampaignRecipientDto)
  recipients?: CampaignRecipientDto[];
}
