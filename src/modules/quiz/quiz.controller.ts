import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards';
import { CurrentUser } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { QuizService } from './quiz.service';
import { SubmitQuizDto } from './dto';

@ApiTags('Quiz')
@Controller('quiz')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Preguntas y estado del examen final de una categoría',
  })
  async getQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId') categoryId: string,
  ) {
    return this.quizService.getQuestions(user.sub, categoryId, user.role);
  }

  @Post('category/:categoryId/attempt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar intento de examen final' })
  async submitAttempt(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId') categoryId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizService.submitAttempt(
      user.sub,
      categoryId,
      user.role,
      dto.answers,
    );
  }
}
