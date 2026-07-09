import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class SubmitFormResponseDto {
  @ApiProperty({
    description: 'Respuestas por ID de campo: { [fieldId]: string | string[] | { value: boolean, context?: string } }',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsNotEmpty()
  answers: Record<string, unknown>;
}
