import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitQuizDto {
  @ApiProperty({
    description:
      'Respuestas del alumno: { [questionId]: boolean } (true = Verdadero, false = Falso)',
    example: { q1: true, q2: false },
  })
  @IsObject()
  answers: Record<string, boolean>;
}
